-- #681: een gastspeler achteraf koppelen aan een echt account, met behoud van
-- rating en matchhistorie. Spiegel van supabase/schemas/tables/20_guest_claims.sql,
-- supabase/schemas/policies/guest_claims.sql en
-- supabase/schemas/functions/27_guest_claims.sql; zie die bestanden voor de
-- volledige toelichting. Kern: de merge verhangt de matches naar andere teams
-- in plaats van de team-rijen te muteren, zodat de statement-level triggers op
-- public.matches alle afgeleide data (ratings, pias, Zwarte Piet, rangstand,
-- dictator-termijnen) precies één keer herberekenen.
--
-- Raakt daarnaast twee functies rond de toto (spiegel van
-- supabase/schemas/functions/19_match_predictions.sql):
--   * match_predictions_guard laat een tip die door zo'n merge naar een
--     niet-meespelend team wijst weer rechtzetten;
--   * de puntentoekenning is uit de trigger gelicht in _grade_completed_match,
--     zodat de merge de verhangen tips opnieuw kan laten scoren.

-- Koppelverzoeken voor gastspelers (#681). Een gast (profiles.is_guest) speelt
-- volwaardig mee en bouwt matchhistorie en Elo op; maakt die persoon later écht
-- een account aan, dan staat die historie op het verkeerde profiel. De eigenaar
-- van de gast (owner_id) vraagt de koppeling aan, het echte account bevestigt
-- of weigert — zonder bevestiging schrijft niemand historie op andermans naam.
--
-- Alleen de RPC's uit functions/27_guest_claims.sql schrijven in deze tabel;
-- de client leest 'm enkel (zie policies/guest_claims.sql).
--
-- Bewust géén 'accepted'-status: bij een geslaagde koppeling verdwijnt het
-- gastprofiel en cascadeert de rij mee. Een verzoek is dus altijd óf open, óf
-- afgewezen/ingetrokken, óf verdwenen omdat het gelukt is.
create table public.guest_claims (
  id uuid primary key default gen_random_uuid(),
  -- De gast wiens historie verhuist.
  guest_id uuid not null references public.profiles (id) on delete cascade,
  -- Het echte account dat de historie overneemt; bevestigt zelf.
  player_id uuid not null references public.profiles (id) on delete cascade,
  -- De eigenaar van de gast, die het verzoek startte. Apart van guest_id
  -- opgeslagen omdat de gast na een geslaagde koppeling verdwijnt.
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_claims_distinct check (guest_id <> player_id)
);

-- Hoogstens één openstaand verzoek per gast: anders zouden twee spelers
-- tegelijk dezelfde historie kunnen claimen.
create unique index guest_claims_open_uidx
  on public.guest_claims (guest_id)
  where status = 'pending';

-- "Heb ik openstaande verzoeken?" is de hoofdquery van de ontvanger.
create index guest_claims_player_idx
  on public.guest_claims (player_id)
  where status = 'pending';

alter table public.guest_claims enable row level security;

-- Koppelverzoeken (#681): alleen de twee betrokkenen zien het verzoek — de
-- aanvrager (de eigenaar van de gast) en het echte account dat moet bevestigen.
-- Schrijven kan uitsluitend via de RPC's (request_guest_claim,
-- claim_guest_player, cancel_guest_claim), want die bewaken de autorisatie en
-- de conflictcheck; vandaar geen insert/update/delete-policy én ingetrokken
-- schrijfrechten.
create policy "guest_claims_select_betrokkenen" on public.guest_claims
  for select
  using ((select auth.uid()) in (requested_by, player_id));

revoke insert, update, delete on public.guest_claims from authenticated;
grant select on public.guest_claims to authenticated;

-- Gast koppelen aan een echt account (#681). Zie tables/20_guest_claims.sql
-- voor het waarom; hier staat het hoe.
--
-- Flow: de eigenaar van de gast doet een verzoek (request_guest_claim), het
-- echte account bevestigt (claim_guest_player) of weigert/de aanvrager trekt in
-- (cancel_guest_claim). De merge is onomkeerbaar en draait in één transactie.
--
-- KERN VAN DE MERGE: de matches worden naar ándere teams verhangen in plaats
-- van de team-rijen ter plekke te muteren. Alle afgeleide data — ratings, pias
-- van de week, Zwarte Piet, rangstand, dictator-termijnen — hangt namelijk aan
-- statement-level triggers op public.matches. Eén UPDATE daar herberekent dus
-- precies één keer alles, in de juiste triggervolgorde (zie 09_ratings.sql:
-- een gewijzigd team_a_id/team_b_id op een afgeronde match kiest het
-- v_full-pad, oftewel recompute_ratings). Muteren van teams zou géén trigger
-- laten vuren en zou vijf recomputes met de hand vergen die voor eeuwig
-- synchroon gehouden moeten worden.
--
-- Vangnet: matches.team_a_id/team_b_id/winner_team_id zijn `on delete
-- restrict`. Het gastprofiel verwijderen cascadeert naar zijn teams, en die
-- delete knalt op de restrict zolang er nog één match naar wijst. Een
-- half-uitgevoerde merge kan dus nooit stilletjes matches wissen.

-- Blokkerende botsingen tussen een gast en een echt account. Geeft null als er
-- niets in de weg staat, anders precies de melding die de gebruiker ziet.
-- Gebruikt door zowel het verzoek (droge check, vóór je iemand anders lastigvalt)
-- als de bevestiging (want er kan intussen een match bijgekomen zijn).
create or replace function public._guest_claim_conflict(p_guest uuid, p_player uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  -- Speelden ze ooit in dezelfde match — samen in een team of tegen elkaar —
  -- dan is die match na de merge onzinnig: het samengevoegde team zou op
  -- teams_distinct_players knallen, of beide teams van de match zouden
  -- hetzelfde worden (matches_distinct_teams). Blokkeren met een duidelijke
  -- melding in plaats van een constraint-fout. De uitweg is per match de gast
  -- vervangen (#681, deel 2).
  select case when count(*) > 0 then format(
    'De gast en deze speler stonden samen in %s match(es). Die zouden na het koppelen onzinnig worden — vervang de gast eerst in die matches.',
    count(*)
  ) end
  from public.matches m
  join public.teams ta on ta.id = m.team_a_id
  join public.teams tb on tb.id = m.team_b_id
  where (ta.player1_id = p_guest or ta.player2_id = p_guest
      or tb.player1_id = p_guest or tb.player2_id = p_guest)
    and (ta.player1_id = p_player or ta.player2_id = p_player
      or tb.player1_id = p_player or tb.player2_id = p_player);
$$;

revoke execute on function public._guest_claim_conflict(uuid, uuid) from public;

-- Stap 1: de eigenaar van de gast vraagt de koppeling aan. Geeft de id van het
-- (bestaande of nieuwe) verzoek terug, zodat opnieuw versturen een no-op is.
create or replace function public.request_guest_claim(p_guest_id uuid, p_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
  v_is_guest boolean;
  v_target_is_guest boolean;
  v_conflict text;
  v_open public.guest_claims;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_guest_id = p_player_id then
    raise exception 'Kies een ander account dan de gast zelf';
  end if;

  select is_guest, owner_id into v_is_guest, v_owner
  from public.profiles where id = p_guest_id;
  if not found then
    raise exception 'Gastspeler niet gevonden';
  end if;
  if not v_is_guest then
    raise exception 'Dit profiel is geen gastspeler';
  end if;
  if v_owner is distinct from v_uid then
    raise exception 'Alleen wie de gast aanmaakte kan hem koppelen';
  end if;

  select is_guest into v_target_is_guest
  from public.profiles where id = p_player_id;
  if not found then
    raise exception 'Speler niet gevonden';
  end if;
  if v_target_is_guest then
    raise exception 'Een gast koppel je aan een echt account, niet aan een andere gast';
  end if;

  -- Bereikbaarheid: alleen iemand die je kent kun je aanwijzen. Zonder deze
  -- check kon je elk willekeurig account een "ben jij deze gast?"-verzoek
  -- sturen. Dezelfde populatie als de spelerkiezer in de UI.
  if p_player_id <> v_uid
     and not public.are_friends(v_uid, p_player_id)
     and not public.shares_group(v_uid, p_player_id) then
    raise exception 'Koppelen kan alleen met een vriend of een groepsgenoot';
  end if;

  -- Droge conflictcheck: liever nu een duidelijke melding dan pas bij de
  -- bevestiging van de ander.
  v_conflict := public._guest_claim_conflict(p_guest_id, p_player_id);
  if v_conflict is not null then
    raise exception '%', v_conflict;
  end if;

  select * into v_open
  from public.guest_claims
  where guest_id = p_guest_id and status = 'pending';
  if found then
    if v_open.player_id = p_player_id then
      return v_open.id;  -- zelfde verzoek nog eens: no-op
    end if;
    raise exception 'Er loopt al een koppelverzoek voor deze gast';
  end if;

  insert into public.guest_claims (guest_id, player_id, requested_by)
  values (p_guest_id, p_player_id, v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.request_guest_claim(uuid, uuid) to authenticated;

-- Stap 2: het echte account bevestigt. Alle historie van de gast verhuist en
-- het gastprofiel verdwijnt. Geeft een samenvatting terug voor de bevestiging
-- in de UI: {"matches": n, "groepen": n}.
create or replace function public.claim_guest_player(p_guest_id uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claim public.guest_claims;
  v_is_guest boolean;
  v_target_is_guest boolean;
  v_conflict text;
  v_old uuid[] := '{}';   -- teams mét de gast
  v_new uuid[] := '{}';   -- de bijbehorende teams mét het echte account
  v_target uuid;
  v_matches int := 0;
  v_groepen int := 0;
  r record;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if v_uid is distinct from p_player_id then
    raise exception 'Alleen het echte account kan de koppeling bevestigen';
  end if;

  -- Serialiseer per gast: twee gelijktijdige merges zouden elkaars
  -- team-mapping overschrijven.
  perform pg_advisory_xact_lock(hashtext('guest_claim'), hashtext(p_guest_id::text));

  select * into v_claim
  from public.guest_claims
  where guest_id = p_guest_id and player_id = p_player_id and status = 'pending'
  for update;
  if not found then
    raise exception 'Geen openstaand koppelverzoek voor deze gast';
  end if;

  select is_guest into v_is_guest
  from public.profiles where id = p_guest_id for update;
  if not found or not v_is_guest then
    raise exception 'Gastspeler niet gevonden';
  end if;

  select is_guest into v_target_is_guest
  from public.profiles where id = p_player_id for update;
  if not found or v_target_is_guest then
    raise exception 'Speler niet gevonden';
  end if;

  -- Opnieuw checken: sinds het verzoek kan er een match bijgekomen zijn waarin
  -- ze allebei stonden.
  v_conflict := public._guest_claim_conflict(p_guest_id, p_player_id);
  if v_conflict is not null then
    raise exception '%', v_conflict;
  end if;

  --------------------------------------------------------------------------
  -- 1. Lidmaatschappen en per-speler-rijen. Bewust vóór het verhangen van de
  --    matches: de recomputes die daaraan hangen (rangstand, Zwarte Piet)
  --    moeten de speler al als groepslid zien.
  --------------------------------------------------------------------------
  -- group_members (PK group_id+player_id): bij dubbel lidmaatschap wint de
  -- hoogste rol, daarna verdwijnt de gastrij.
  update public.group_members gm
     set role = 'owner'
   where gm.player_id = p_player_id
     and gm.role <> 'owner'
     and exists (
       select 1 from public.group_members g
       where g.group_id = gm.group_id and g.player_id = p_guest_id
         and g.role = 'owner'
     );
  delete from public.group_members gm
   where gm.player_id = p_guest_id
     and exists (
       select 1 from public.group_members g
       where g.group_id = gm.group_id and g.player_id = p_player_id
     );
  update public.group_members set player_id = p_player_id where player_id = p_guest_id;
  get diagnostics v_groepen = row_count;

  -- Aanwezigheid, slot-beschikbaarheid en poll-stemmen: unieke sleutel per
  -- (speler, x). Eerst de gastrij weggooien waar de speler al een rij heeft,
  -- dan omhangen.
  delete from public.attendance a
   where a.player_id = p_guest_id
     and exists (
       select 1 from public.attendance b
       where b.group_id = a.group_id and b.date = a.date and b.player_id = p_player_id
     );
  update public.attendance set player_id = p_player_id where player_id = p_guest_id;

  delete from public.slot_availability s
   where s.player_id = p_guest_id
     and exists (
       select 1 from public.slot_availability t
       where t.group_id = s.group_id and t.date = s.date
         and t.start_time = s.start_time and t.player_id = p_player_id
     );
  update public.slot_availability set player_id = p_player_id where player_id = p_guest_id;

  delete from public.play_poll_votes v
   where v.player_id = p_guest_id
     and exists (
       select 1 from public.play_poll_votes w
       where w.option_id = v.option_id and w.player_id = p_player_id
     );
  update public.play_poll_votes set player_id = p_player_id where player_id = p_guest_id;

  -- Vriendschappen: requester_id/addressee_id zijn bevroren
  -- (friendships_freeze_participants), dus kopiëren in plaats van omhangen —
  -- de gastrijen verdwijnen straks met het profiel. Openstaande verzoeken van
  -- of aan een gast gaan niet mee: die kan niemand nog accepteren, en een
  -- kopie zou op de privacy-trigger kunnen stuklopen. In de praktijk is dit
  -- theoretisch: een gast kan geen verzoek sturen of ontvangen.
  insert into public.friendships (requester_id, addressee_id, status, created_at, updated_at)
  select case when f.requester_id = p_guest_id then p_player_id else f.requester_id end,
         case when f.addressee_id = p_guest_id then p_player_id else f.addressee_id end,
         f.status, f.created_at, now()
    from public.friendships f
   where f.status = 'accepted'
     and (f.requester_id = p_guest_id or f.addressee_id = p_guest_id)
     -- Gast ↔ het echte account zelf zou een zelfverwijzing worden.
     and f.requester_id <> p_player_id
     and f.addressee_id <> p_player_id
     -- Dubbel paar: bestaat de relatie al voor het echte account, dan die houden.
     and not exists (
       select 1 from public.friendships g
       where (g.requester_id = p_player_id
              and g.addressee_id = case when f.requester_id = p_guest_id
                                        then f.addressee_id else f.requester_id end)
          or (g.addressee_id = p_player_id
              and g.requester_id = case when f.requester_id = p_guest_id
                                        then f.addressee_id else f.requester_id end)
     );

  -- Vendetta's: idem, want vendettas_guard weigert elke UPDATE op een al
  -- beëindigde vendetta. Zelfverwijzingen en een dubbele actieve rivaliteit in
  -- dezelfde groep vallen af. De insert-guard eist dat de rivaal groepslid is —
  -- dat klopt inmiddels, want group_members is hierboven al omgehangen.
  insert into public.vendettas (group_id, challenger_id, rival_id, target_wins, status, started_at, ended_at)
  select v.group_id,
         case when v.challenger_id = p_guest_id then p_player_id else v.challenger_id end,
         case when v.rival_id = p_guest_id then p_player_id else v.rival_id end,
         v.target_wins, v.status, v.started_at, v.ended_at
    from public.vendettas v
   where (v.challenger_id = p_guest_id or v.rival_id = p_guest_id)
     and v.challenger_id <> p_player_id
     and v.rival_id <> p_player_id
     and not (v.status = 'active' and exists (
       select 1 from public.vendettas w
       where w.status = 'active' and w.group_id = v.group_id
         and (w.challenger_id = p_player_id or w.rival_id = p_player_id)
         and (case when w.challenger_id = p_player_id then w.rival_id else w.challenger_id end)
             = (case when v.challenger_id = p_guest_id then v.rival_id else v.challenger_id end)
     ));

  --------------------------------------------------------------------------
  -- 2. Teams in kaart brengen: elk team mét de gast krijgt zijn tegenhanger
  --    mét het echte account. _ensure_team hergebruikt een bestaand paar of
  --    maakt het aan, en dekt singles (p_b null) ongewijzigd af.
  --------------------------------------------------------------------------
  for r in
    select t.id,
           case when t.player1_id = p_guest_id then t.player2_id else t.player1_id end as medespeler
      from public.teams t
     where t.player1_id = p_guest_id or t.player2_id = p_guest_id
     order by t.id
  loop
    -- Een team gast+speler zelf komt hier niet voor met matches (dat is de
    -- conflictcheck hierboven); zonder matches laten we het door de
    -- profiel-cascade opruimen.
    continue when r.medespeler is not distinct from p_player_id;

    v_target := public._ensure_team(p_player_id, r.medespeler);
    v_old := v_old || r.id;
    v_new := v_new || v_target;
  end loop;

  select count(*) into v_matches
    from public.matches m
   where m.team_a_id = any (v_old) or m.team_b_id = any (v_old);

  --------------------------------------------------------------------------
  -- 3. Eén UPDATE op matches: teams verhangen én het aanmakerschap overnemen.
  --    Hier vuren alle statement-level triggers precies één keer — dit ís de
  --    volledige rating-recompute die de koppeling nodig heeft.
  --------------------------------------------------------------------------
  if v_matches > 0
     or exists (select 1 from public.matches where created_by = p_guest_id) then
    with map as (
      select o.old_id, n.new_id
      from unnest(v_old) with ordinality as o(old_id, i)
      join unnest(v_new) with ordinality as n(new_id, i) using (i)
    )
    update public.matches m
       set team_a_id = coalesce((select new_id from map where old_id = m.team_a_id), m.team_a_id),
           team_b_id = coalesce((select new_id from map where old_id = m.team_b_id), m.team_b_id),
           winner_team_id = coalesce((select new_id from map where old_id = m.winner_team_id), m.winner_team_id),
           created_by = case when m.created_by = p_guest_id then p_player_id else m.created_by end
     where m.team_a_id = any (v_old)
        or m.team_b_id = any (v_old)
        or m.created_by = p_guest_id;
  end if;

  --------------------------------------------------------------------------
  -- 4. Overige verwijzingen naar de oude teams. Ná de matches-update, zodat
  --    won_by_team_id nooit naar een team wijst dat niet in de match zit en de
  --    tip-guard de herstelroute herkent (zie 19_match_predictions.sql).
  --------------------------------------------------------------------------
  if array_length(v_old, 1) > 0 then
    with map as (
      select o.old_id, n.new_id
      from unnest(v_old) with ordinality as o(old_id, i)
      join unnest(v_new) with ordinality as n(new_id, i) using (i)
    )
    update public.match_points mp
       set won_by_team_id = (select new_id from map where old_id = mp.won_by_team_id)
     where mp.won_by_team_id = any (v_old);

    with map as (
      select o.old_id, n.new_id
      from unnest(v_old) with ordinality as o(old_id, i)
      join unnest(v_new) with ordinality as n(new_id, i) using (i)
    )
    update public.match_predictions p
       set predicted_team_id = (select new_id from map where old_id = p.predicted_team_id)
     where p.predicted_team_id = any (v_old);

    -- De afrondingstrigger heeft tijdens stap 3 al gescoord, toen de tips nog
    -- naar het opgeruimde team wezen — een juiste tip stond dan onterecht op
    -- 'mis'. Nu de tips kloppen, de betrokken matches opnieuw laten beoordelen.
    perform public._grade_completed_match(m.id)
       from public.matches m
      where m.status = 'completed'
        and (m.team_a_id = any (v_new) or m.team_b_id = any (v_new))
        and exists (select 1 from public.match_predictions p where p.match_id = m.id);
  end if;

  -- Smoesjes: de guard hercontroleert bij een UPDATE of de speler in het
  -- verliezende team zat — dat klopt pas nu de matches verhangen zijn.
  delete from public.match_smoesjes ms
   where ms.player_id = p_guest_id
     and exists (
       select 1 from public.match_smoesjes mt
       where mt.match_id = ms.match_id and mt.player_id = p_player_id
     );
  update public.match_smoesjes set player_id = p_player_id where player_id = p_guest_id;

  -- Aanmakerschap buiten matches (die ging mee in stap 3).
  update public.groups set created_by = p_player_id where created_by = p_guest_id;
  update public.group_invites set created_by = p_player_id where created_by = p_guest_id;
  update public.play_polls set created_by = p_player_id where created_by = p_guest_id;

  --------------------------------------------------------------------------
  -- 5. Weg met de gast. De cascade ruimt op wat bewust niet meeverhuisde: zijn
  --    lege teams, zijn tips (die kan niemand herschrijven zonder de guard te
  --    breken; een gast kan er in de praktijk geen hebben), zijn rating-rijen
  --    (stap 3 heeft die al herbouwd) en dit koppelverzoek zelf.
  --------------------------------------------------------------------------
  delete from public.profiles where id = p_guest_id;

  return jsonb_build_object('matches', v_matches, 'groepen', v_groepen);
end;
$$;

grant execute on function public.claim_guest_player(uuid, uuid) to authenticated;

-- Stap 2b: weigeren (door het echte account) of intrekken (door de aanvrager).
-- Beide kanten mogen een openstaand verzoek sluiten.
create or replace function public.cancel_guest_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claim public.guest_claims;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select * into v_claim from public.guest_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Koppelverzoek niet gevonden';
  end if;
  if v_claim.status <> 'pending' then
    return;  -- al gesloten: no-op
  end if;

  if v_uid = v_claim.player_id then
    update public.guest_claims
       set status = 'declined', updated_at = now()
     where id = p_claim_id;
  elsif v_uid = v_claim.requested_by then
    update public.guest_claims
       set status = 'cancelled', updated_at = now()
     where id = p_claim_id;
  else
    raise exception 'Je hoort niet bij dit koppelverzoek';
  end if;
end;
$$;

grant execute on function public.cancel_guest_claim(uuid) to authenticated;

-- Aangepaste tip-guard en puntentoekenning (#681); de triggers zelf bestaan al.
-- Guard: tippen kan alleen op een nog niet gestarte, geplande groepsmatch,
-- op een team dat echt meespeelt, met een group_id die echt bij de match
-- hoort. De winkans-snapshot wordt hier gezet, nooit door de client.
create or replace function public.match_predictions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  -- Doorlaat voor de grader: een UPDATE die de tip zelf niet wijzigt
  -- (alleen points) hoeft niet opnieuw gevalideerd te worden.
  if tg_op = 'UPDATE'
     and new.predicted_team_id = old.predicted_team_id
     and new.match_id = old.match_id
     and new.player_id = old.player_id
     and new.group_id = old.group_id then
    return new;
  end if;

  select id, group_id, status, played_at, team_a_id, team_b_id
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;

  -- Herstel na een team-merge (#681): claim_guest_player verhangt een match
  -- naar een ander team, waardoor bestaande tips naar een team wijzen dat niet
  -- meer meespeelt. Zo'n bungelende verwijzing mag rechtgezet worden naar een
  -- team dat er wél in zit — ook op een al afgeronde match, anders zou de
  -- toto-historie sneuvelen. Strikt afgebakend: alleen het team verandert, de
  -- winkans-snapshot en de toegekende punten blijven staan, en de oude waarde
  -- moet écht bungelen. Een tipper kan hier niets mee winnen: zijn punten zijn
  -- al toegekend en wijzigen niet mee.
  if tg_op = 'UPDATE'
     and new.match_id = old.match_id
     and new.player_id = old.player_id
     and new.group_id = old.group_id
     and new.win_chance = old.win_chance
     and new.points is not distinct from old.points
     and old.predicted_team_id not in (m.team_a_id, m.team_b_id)
     and new.predicted_team_id in (m.team_a_id, m.team_b_id) then
    return new;
  end if;
  if m.group_id is null or m.group_id is distinct from new.group_id then
    raise exception 'tippen kan alleen op groepsmatches';
  end if;
  if m.status <> 'scheduled' then
    raise exception 'deze match is al begonnen of afgerond';
  end if;
  if m.played_at is not null and m.played_at <= now() then
    raise exception 'de match is al begonnen';
  end if;
  if new.predicted_team_id not in (m.team_a_id, m.team_b_id) then
    raise exception 'het getipte team speelt niet mee in deze match';
  end if;

  new.win_chance := public.prediction_win_chance(new.match_id, new.predicted_team_id);
  new.points := null;
  new.updated_at := now();
  return new;
end;
$$;

-- Beoordeelt de tips van één afgeronde match. Apart van de trigger, omdat
-- claim_guest_player (#681) na het verhangen van een team de tips meeverhuist
-- en ze daarna opnieuw moet laten scoren: tijdens de matches-UPDATE wees de tip
-- nog naar het opgeruimde team en zou hij onterecht als 'mis' eindigen.
create or replace function public._grade_completed_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.match_predictions p
     set points = case
           when m.winner_team_id is not null
            and p.predicted_team_id = m.winner_team_id
           then public.prediction_points(p.win_chance)
           else 0
         end
    from public.matches m
   where m.id = p_match and m.status = 'completed' and p.match_id = m.id;
end;
$$;

revoke execute on function public._grade_completed_match(uuid) from public;

create or replace function public.grade_match_predictions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    perform public._grade_completed_match(new.id);
  elsif old.status = 'completed' then
    update public.match_predictions p
       set points = null
     where p.match_id = new.id;
  end if;
  return null;
end;
$$;
