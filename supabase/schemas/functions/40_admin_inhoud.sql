-- Beheer van de inhoud: matches, groepen en polls (#1159).
--
-- #1036 gaf de beheerder macht over accounts. Over de inhoud had hij precies
-- evenveel rechten als elke andere speler: een foute uitslag in een groep waar
-- hij niet in zit kon hij niet corrigeren, de match niet verwijderen, en hij zag
-- hem niet eens staan (policies/matches.sql toont groepsmatches enkel aan
-- leden). Een groep zonder eigenaar was zelfs voor niemand meer beheerbaar.
--
-- Waarom leesfuncties en géén ruimere RLS. De voor de hand liggende oplossing —
-- `or is_app_admin(auth.uid())` bij de select-policy op matches — heeft een
-- stille bijwerking: getRecentMatches(), getRecentResults() en
-- getCompletedMatchesBetween() (src/features/matches/api.ts) filteren niet op
-- groep. De beheerder zou daarmee de matches van álle vreemde groepen in zijn
-- eigen dashboard-feed én in zijn client-berekende kwartaalstand krijgen.
-- Beheerdersrechten horen het klassement van de beheerder niet te verbouwen,
-- dus loopt alles hier langs de service-role: nul policy-wijzigingen, en het
-- auditspoor komt er gratis bij (die rol is de enige die in admin_audit_log mag
-- schrijven).
--
-- Alles hieronder is dus service-role-only, exact zoals 37_app_admin.sql: de
-- client praat met de edge function `admin-content`, nooit met deze functies.
-- De grants maken dat afdwingbaar in plaats van afgesproken.
--
-- Muteren staat hier bewust níet bij, op één na. Een score corrigeren, een match
-- verwijderen, een poll heropenen: dat is één update of delete die de
-- service-role-client rechtstreeks doet, en een RPC eromheen zou alleen maar een
-- tweede plek zijn waar de regels staan. De rating-triggers op public.matches
-- vuren daar gewoon bij, dus een correctie rekent door in de stand (zie de kop
-- van 16_delete_match.sql). De uitzondering is het overdragen van
-- eigenaarschap: dat staat op twee plekken tegelijk en moet dus atomair.

-- 1. Alle matches, over alle groepen heen ------------------------------------
--
-- `totaal` is de telling vóór de limiet, zodat het paneel "200 van 743 getoond"
-- kan zeggen. Een stille afkap leest als volledigheid, en juist hier ga je
-- ervan uit dat je alles ziet.
create or replace function public.admin_matches_overzicht(
  p_group uuid default null,
  p_van timestamptz default null,
  p_tot timestamptz default null,
  p_status text default null,
  p_zoek text default null,
  p_limit integer default 200,
  -- Eén match opvragen (na een correctie, of om de auditdetails te verzamelen
  -- vlak vóór een verwijdering). Zelfde vorm terug als de lijst, zodat het
  -- paneel en het logboek dezelfde velden zien.
  p_match uuid default null
)
returns table (
  id uuid,
  played_at timestamptz,
  created_at timestamptz,
  status text,
  score_a smallint,
  score_b smallint,
  set_scores jsonb,
  winner_team_id uuid,
  team_a_id uuid,
  team_b_id uuid,
  group_id uuid,
  groep_naam text,
  team_a_spelers text[],
  team_b_spelers text[],
  created_by uuid,
  aanmaker_username text,
  totaal bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  with basis as (
    select
      m.id,
      m.played_at,
      m.created_at,
      m.status::text as status,
      m.score_a,
      m.score_b,
      m.set_scores,
      m.winner_team_id,
      m.team_a_id,
      m.team_b_id,
      m.group_id,
      g.name as groep_naam,
      -- array_remove: bij een 1v1 (format '1v1') is player2_id null.
      array_remove(array[pa1.username, pa2.username], null) as team_a_spelers,
      array_remove(array[pb1.username, pb2.username], null) as team_b_spelers,
      m.created_by,
      pc.username as aanmaker_username
    from public.matches m
    left join public.groups g on g.id = m.group_id
    join public.teams ta on ta.id = m.team_a_id
    join public.teams tb on tb.id = m.team_b_id
    left join public.profiles pa1 on pa1.id = ta.player1_id
    left join public.profiles pa2 on pa2.id = ta.player2_id
    left join public.profiles pb1 on pb1.id = tb.player1_id
    left join public.profiles pb2 on pb2.id = tb.player2_id
    left join public.profiles pc on pc.id = m.created_by
    where (p_match is null or m.id = p_match)
      and (p_group is null or m.group_id = p_group)
      -- Een geplande match zonder played_at valt anders buiten elk venster;
      -- created_at is dan het enige moment dat hij heeft.
      and (p_van is null or coalesce(m.played_at, m.created_at) >= p_van)
      and (p_tot is null or coalesce(m.played_at, m.created_at) < p_tot)
      and (p_status is null or m.status::text = p_status)
      and (
        p_zoek is null
        or p_zoek = ''
        or g.name ilike '%' || p_zoek || '%'
        or pa1.username ilike '%' || p_zoek || '%'
        or pa2.username ilike '%' || p_zoek || '%'
        or pb1.username ilike '%' || p_zoek || '%'
        or pb2.username ilike '%' || p_zoek || '%'
      )
  )
  select
    b.id,
    b.played_at,
    b.created_at,
    b.status,
    b.score_a,
    b.score_b,
    b.set_scores,
    b.winner_team_id,
    b.team_a_id,
    b.team_b_id,
    b.group_id,
    b.groep_naam,
    b.team_a_spelers,
    b.team_b_spelers,
    b.created_by,
    b.aanmaker_username,
    -- Vensterfunctie: geteld ná de where, vóór de limit. Precies wat we willen.
    count(*) over () as totaal
  from basis b
  order by coalesce(b.played_at, b.created_at) desc, b.id
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

revoke execute on function public.admin_matches_overzicht(uuid, timestamptz, timestamptz, text, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_matches_overzicht(uuid, timestamptz, timestamptz, text, text, integer, uuid)
  to service_role;

-- 2. Polls per groep ---------------------------------------------------------
--
-- Een poll heeft geen titel; het vastgelegde moment is waaraan je hem herkent.
create or replace function public.admin_polls_overzicht(
  p_group uuid default null,
  p_limit integer default 200,
  -- Eén poll opvragen; zie p_match hierboven.
  p_poll uuid default null
)
returns table (
  id uuid,
  group_id uuid,
  groep_naam text,
  status text,
  created_at timestamptz,
  created_by uuid,
  aanmaker_username text,
  vastgelegd_op text,
  aantal_opties bigint,
  aantal_stemmen bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.id,
    p.group_id,
    g.name,
    p.status,
    p.created_at,
    p.created_by,
    pc.username,
    case
      when o.id is null then null
      else to_char(o.date, 'DD-MM-YYYY') || ' ' || o.start_time
    end,
    (select count(*) from public.play_poll_options x where x.poll_id = p.id),
    (
      select count(*)
      from public.play_poll_votes v
      join public.play_poll_options x2 on x2.id = v.option_id
      where x2.poll_id = p.id
    )
  from public.play_polls p
  join public.groups g on g.id = p.group_id
  left join public.profiles pc on pc.id = p.created_by
  left join public.play_poll_options o on o.id = p.locked_option_id
  where (p_poll is null or p.id = p_poll)
    and (p_group is null or p.group_id = p_group)
  order by p.created_at desc, p.id
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

revoke execute on function public.admin_polls_overzicht(uuid, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_polls_overzicht(uuid, integer, uuid) to service_role;

-- 3. Leden van één groep -----------------------------------------------------
--
-- Nodig om een nieuwe eigenaar te kunnen kiezen: dat moet iemand zijn die er al
-- in zit. De eigenaar staat bovenaan.
create or replace function public.admin_groep_leden(p_group uuid)
returns table (
  player_id uuid,
  username text,
  full_name text,
  role text,
  is_guest boolean,
  joined_at timestamptz,
  is_eigenaar boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    gm.player_id,
    p.username,
    p.full_name,
    gm.role,
    p.is_guest,
    gm.joined_at,
    g.created_by = gm.player_id
  from public.group_members gm
  join public.profiles p on p.id = gm.player_id
  join public.groups g on g.id = gm.group_id
  where gm.group_id = p_group
  order by (g.created_by = gm.player_id) desc, p.is_guest, p.username;
$$;

revoke execute on function public.admin_groep_leden(uuid) from public, anon, authenticated;
grant execute on function public.admin_groep_leden(uuid) to service_role;

-- 4. Het volledige auditspoor ------------------------------------------------
--
-- admin_audit_voor(p_uid) beantwoordt "wat is er met deze gebruiker gebeurd".
-- Sinds er ook acties op matches, groepen en polls in het logboek staan, is er
-- een tweede vraag: "wat is er de laatste tijd gebeurd", los van een gebruiker.
create or replace function public.admin_audit_recent(p_limit integer default 100)
returns table (
  id bigint,
  actor_id uuid,
  actor_username text,
  action text,
  target_user_id uuid,
  target_username text,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    l.id,
    l.actor_id,
    a.username,
    l.action,
    l.target_user_id,
    t.username,
    l.target_type,
    l.target_id,
    l.details,
    l.created_at
  from public.admin_audit_log l
  left join public.profiles a on a.id = l.actor_id
  left join public.profiles t on t.id = l.target_user_id
  order by l.created_at desc, l.id desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke execute on function public.admin_audit_recent(integer) from public, anon, authenticated;
grant execute on function public.admin_audit_recent(integer) to service_role;

-- 5. Eigenaarschap overdragen ------------------------------------------------
--
-- De enige mutatie die een RPC verdient, want eigenaarschap staat op twee
-- plekken: groups.created_by (waar alle vier de groepspolicies op vergelijken)
-- en group_members.role (waar de UI op afgaat, zie MatchDetail.tsx). Los
-- bijwerken vanuit de edge function zou een groep achterlaten met een eigenaar
-- die volgens zijn eigen ledenlijst gewoon lid is.
--
-- De nieuwe eigenaar moet al lid zijn. Dat is dezelfde regel als in de UI van
-- de groepseigenaar, en hij voorkomt dat een groep wordt weggegeven aan iemand
-- die er niets mee te maken heeft. Wie het tóch wil: eerst toevoegen als lid.
--
-- Gasten kunnen geen eigenaar worden: die hebben geen account en zouden de
-- groep dus opnieuw stuurloos maken.
create or replace function public.admin_set_group_owner(p_group uuid, p_uid uuid)
returns table (groep text, oude_eigenaar text, nieuwe_eigenaar text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_groep text;
  v_oud uuid;
  v_oud_naam text;
  v_nieuw_naam text;
  v_is_gast boolean;
begin
  -- for update: tussen het lezen en het schrijven mag niemand anders de
  -- eigenaar verzetten.
  select g.name, g.created_by into v_groep, v_oud
  from public.groups g
  where g.id = p_group
  for update;

  if not found then
    raise exception 'Groep niet gevonden';
  end if;

  select p.username, p.is_guest into v_nieuw_naam, v_is_gast
  from public.profiles p
  where p.id = p_uid;

  if not found then
    raise exception 'Speler niet gevonden';
  end if;

  if v_is_gast then
    raise exception 'Een gast kan geen eigenaar worden';
  end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group and gm.player_id = p_uid
  ) then
    raise exception 'Die speler is geen lid van deze groep';
  end if;

  select p.username into v_oud_naam from public.profiles p where p.id = v_oud;

  update public.groups set created_by = p_uid where id = p_group;

  -- Eerst iedereen terug naar 'member', dan de nieuwe eigenaar. Andersom zou de
  -- tweede update de eerste weer ongedaan maken.
  update public.group_members
     set role = 'member'
   where group_id = p_group and role = 'owner';

  update public.group_members
     set role = 'owner'
   where group_id = p_group and player_id = p_uid;

  return query select v_groep, v_oud_naam, v_nieuw_naam;
end;
$$;

revoke execute on function public.admin_set_group_owner(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_set_group_owner(uuid, uuid) to service_role;
