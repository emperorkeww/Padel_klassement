-- De Troon met machtsbehoud (#545): de dictatuur (El Padelissimo, 1600+, #527/
-- #528) is voortaan een alleenheerschappij MÉT machtsbehoud i.p.v. een kale
-- rating-#1. Wie als eerste 1600+ haalt pakt de troon en houdt 'm tot iemand hem
-- STRIKT verslaat (>, niet ≥ — de zittende wint de tie). Zakt de zittende onder
-- 1600, dan valt de troon aan de hoogste andere 1600+, of hij komt vacant (→ in
-- de UI de waarnemend Mbappé, #530).
--
-- Dit vereist volgorde-afhankelijke state ("eerste die claimt", "incumbent wint
-- de tie") die niet uit één rating-snapshot volgt. Zelfde model als zwarte_piet
-- (#185) en de ratings zelf (09_ratings): een SECURITY DEFINER-replay over de
-- volledige, chronologische matchhistorie, die na élke match herberekent. De
-- troon-termijnen (van/tot) voeden bovendien de regeerduur op het profiel.
--
-- Afgeleide, read-only data: enkel de replay-trigger schrijft. RLS aan met een
-- publieke select-policy — de troon is globaal en overal in de app zichtbaar —
-- en de write-grants ge-revoket. NB: `supabase db diff` genereert hier spurious
-- view-drops en write-grants; die horen niet in deze migratie (zie het geheugen
-- over db diff-ruis).

create table if not exists public.dictator_termijnen (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  -- Speelmoment (played_at, val terug op created_at) van de claim-match.
  begon_op     timestamptz not null,
  -- Einde van de termijn; null = lopende termijn (de zittende dictator).
  eindigde_op  timestamptz,
  -- Rating waarmee de troon gepakt werd — voor propaganda/erepalmpje.
  claim_rating integer not null,
  constraint dictator_termijnen_duur_chk
    check (eindigde_op is null or eindigde_op >= begon_op)
);

alter table public.dictator_termijnen enable row level security;

-- Hoogstens één lopende termijn tegelijk (de zittende dictator). De expressie is
-- binnen de partial index constant TRUE, dus dit dwingt "max. 1 open rij" af.
create unique index dictator_termijnen_een_actief
  on public.dictator_termijnen ((eindigde_op is null))
  where eindigde_op is null;

-- Regeerduur per profiel telt alle termijnen van een speler op.
create index dictator_termijnen_profiel_idx
  on public.dictator_termijnen (profile_id);

set check_function_bodies = off;

-- Replay: loop de afgeronde matches chronologisch af, houd een lopende
-- rating-snapshot per speler bij (rating_after uit rating_history) en pas per
-- match de #545-regels toe. Gasten (is_guest) tellen niet mee — de troon is voor
-- clubleden. Deterministisch: gelijke stand → de zittende houdt de troon (strikte
-- >), en bij een vacante troon met exact gelijke uitdagers wint het langste lid
-- (created_at asc, dan id).
create or replace function public.recompute_dictator_termijnen()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  drempel constant int := 1600;   -- El Padelissimo-instap (#527, tiers.ts)
  m record;
  v_snap jsonb := '{}'::jsonb;     -- lopende rating per speler (player_id → rating)
  v_dictator uuid := null;         -- zittende dictator (open termijn)
  v_begon_op timestamptz := null;
  v_claim int := null;
  v_inc_rating int;                -- rating van de zittende ná deze match
  v_top_id uuid;                   -- hoogste kwalificerende speler (≥ drempel)
  v_top_rating int;
begin
  -- WHERE true: safeupdate blokkeert een ongekwalificeerde DELETE (zie 09_ratings).
  delete from public.dictator_termijnen where true;

  for m in
    select mt.id,
           coalesce(mt.played_at, mt.created_at) as ts
    from public.matches mt
    where mt.status = 'completed'
    order by coalesce(mt.played_at, mt.created_at), mt.created_at, mt.id
  loop
    -- Werk de snapshot bij met de uitkomst van deze match (rating_after per
    -- betrokken, niet-gast speler). Geen betrokkenen → snapshot ongewijzigd.
    select v_snap || coalesce(
             jsonb_object_agg(rh.player_id::text, rh.rating_after), '{}'::jsonb)
      into v_snap
      from public.rating_history rh
      join public.profiles p on p.id = rh.player_id
      where rh.match_id = m.id and not p.is_guest;

    -- Terugval: zakt de zittende onder de drempel, dan sluit z'n termijn en komt
    -- de troon (voorlopig) vacant — een hoger 1600+-lid kan 'm hieronder pakken.
    if v_dictator is not null then
      v_inc_rating := (v_snap ->> v_dictator::text)::int;
      if v_inc_rating is null or v_inc_rating < drempel then
        insert into public.dictator_termijnen (profile_id, begon_op, eindigde_op, claim_rating)
        values (v_dictator, v_begon_op, m.ts, v_claim);
        v_dictator := null; v_begon_op := null; v_claim := null;
      end if;
    end if;

    -- Hoogste kwalificerende speler (≥ drempel); tie-break langste lid, dan id.
    select s.key_id, s.rating
      into v_top_id, v_top_rating
      from (
        select (e.key)::uuid as key_id, (e.value)::int as rating
        from jsonb_each_text(v_snap) e
      ) s
      join public.profiles p on p.id = s.key_id
      where s.rating >= drempel and not p.is_guest
      order by s.rating desc, p.created_at asc, p.id asc
      limit 1;

    if v_dictator is null then
      -- Vacante troon: de hoogste 1600+ claimt (of hij blijft vacant).
      if v_top_id is not null then
        v_dictator := v_top_id; v_begon_op := m.ts; v_claim := v_top_rating;
      end if;
    else
      -- Machtsbehoud: alleen een STRIKT hogere uitdager (≥ drempel, ≠ zittende)
      -- onttroont. Gelijke stand laat de zittende de tie winnen; is de hoogste de
      -- zittende zelf, dan verandert er niets.
      if v_top_id is not null and v_top_id <> v_dictator
         and v_top_rating > v_inc_rating then
        insert into public.dictator_termijnen (profile_id, begon_op, eindigde_op, claim_rating)
        values (v_dictator, v_begon_op, m.ts, v_claim);
        v_dictator := v_top_id; v_begon_op := m.ts; v_claim := v_top_rating;
      end if;
    end if;
  end loop;

  -- Lopende termijn van de huidige zittende dictator (eindigde_op = null).
  if v_dictator is not null then
    insert into public.dictator_termijnen (profile_id, begon_op, eindigde_op, claim_rating)
    values (v_dictator, v_begon_op, null, v_claim);
  end if;
end;
$function$
;

revoke execute on function public.recompute_dictator_termijnen() from public;

create or replace function public.trigger_recompute_dictator_termijnen()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform public.recompute_dictator_termijnen();
  return null;
end;
$function$
;

revoke execute on function public.trigger_recompute_dictator_termijnen() from public;

-- Read-only voor clients: enkel select. Alleen de SECURITY DEFINER-trigger schrijft.
grant select on table "public"."dictator_termijnen" to "anon";
grant select on table "public"."dictator_termijnen" to "authenticated";
grant delete    on table "public"."dictator_termijnen" to "service_role";
grant insert    on table "public"."dictator_termijnen" to "service_role";
grant references on table "public"."dictator_termijnen" to "service_role";
grant select    on table "public"."dictator_termijnen" to "service_role";
grant trigger   on table "public"."dictator_termijnen" to "service_role";
grant truncate  on table "public"."dictator_termijnen" to "service_role";
grant update    on table "public"."dictator_termijnen" to "service_role";

-- De troon is globaal en overal zichtbaar (klassement + profiel): publiek leesbaar.
create policy "dictator_termijnen_select_all"
  on "public"."dictator_termijnen"
  as permissive
  for select
  to public
using (true);

-- Statement-trigger op matches, ná de Elo-triggers: "troon" sorteert alfabetisch
-- ná "ratings" (zelfde conventie als pias_of_week/zwarte_piet in 09_ratings),
-- zodat rating_history al bijgewerkt is wanneer we de termijnen herberekenen.
create trigger matches_troon_termijnen
  after insert or delete or update on public.matches
  for each statement execute function public.trigger_recompute_dictator_termijnen();

-- Eenmalige backfill: troon-termijnen opbouwen uit de reeds afgeronde matches.
select public.recompute_dictator_termijnen();
