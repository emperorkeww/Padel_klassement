-- Beheerdersrol en de leesfuncties van het adminpaneel (#1036).
--
-- Alles hier is service-role-only. Het adminpaneel praat nooit rechtstreeks met
-- deze functies: de client roept de edge function `admin-users` aan, die met de
-- service-role-client eerst is_app_admin() checkt en pas daarna een van de
-- overzichtsfuncties draait. De grants hieronder maken dat afdwingbaar in
-- plaats van afgesproken — een `authenticated` sessie krijgt 42501, ook als de
-- functienaam bekend is.

-- Zelfde vorm als de helpers in 01_group_helpers.sql: security definer +
-- search_path = '' + stable, zodat hij ook vanuit een RLS-policy aangeroepen
-- kan worden zonder recursie.
--
-- p_uid is verplicht en heeft bewust geen `default auth.uid()`: met
-- search_path = '' zou zo'n default in de context van de aanroeper geëvalueerd
-- worden, en de enige aanroeper is de edge function die het id sowieso al heeft.
-- (Een `default (select auth.uid())` zoals in de issuetekst is trouwens geen
-- geldige SQL: subqueries mogen niet in een DEFAULT-expressie.)
create or replace function public.is_app_admin(p_uid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.app_admins a where a.user_id = p_uid);
$$;

revoke execute on function public.is_app_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_app_admin(uuid) to service_role;

-- De gebruikerslijst van het paneel: profielen plus de auth-velden die nergens
-- anders te krijgen zijn.
--
-- Waarom dit een RPC is en geen PostgREST-query: het auth-schema staat niet in
-- config.toml's `schemas`-lijst, dus PostgREST kan er niet bij — ook niet met de
-- service-role key. Een security-definer-functie in public is de enige brug. En
-- passant scheelt het een N+1 op de tellingen.
--
-- aantal_matches wordt hier zelf geteld en komt bewust NIET uit de view
-- player_standings: die filtert `where not p.is_guest`, dus een gast met twintig
-- matches zou in dit overzicht op 0 staan — precies de kolom waarop je in het
-- gasten-tabblad afgaat. Eén definitie hergebruiken is mooi tot de definitie de
-- helft van je doelgroep weglaat.
create or replace function public.admin_users_overzicht()
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  is_guest boolean,
  owner_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  banned_until timestamptz,
  is_admin boolean,
  aantal_groepen bigint,
  aantal_matches bigint,
  aantal_gasten bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.is_guest,
    p.owner_id,
    u.email::text,
    -- Gasten hebben geen auth-rij; dan telt de aanmaakdatum van het profiel.
    coalesce(u.created_at, p.created_at),
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.banned_until,
    (a.user_id is not null),
    g.n,
    m.n,
    gs.n
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.app_admins a on a.user_id = p.id
  left join lateral (
    select count(*) as n from public.group_members gm where gm.player_id = p.id
  ) g on true
  left join lateral (
    select count(*) as n
    from public.matches mt
    join public.teams t on t.id in (mt.team_a_id, mt.team_b_id)
    where mt.status = 'completed' and p.id in (t.player1_id, t.player2_id)
  ) m on true
  left join lateral (
    select count(*) as n from public.profiles gp where gp.owner_id = p.id
  ) gs on true
  order by coalesce(u.created_at, p.created_at) desc, p.username;
$$;

revoke execute on function public.admin_users_overzicht() from public, anon, authenticated;
grant execute on function public.admin_users_overzicht() to service_role;

-- Eén gebruiker uitgeklapt. Als jsonb en niet als returns table, omdat de vier
-- deelverzamelingen niets met elkaar te maken hebben; de edge function geeft dit
-- ongewijzigd door aan het detailpaneel.
create or replace function public.admin_user_detail(p_uid uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'groepen', (
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
      from (
        select g.id, g.name, gm.role, gm.joined_at,
               (g.created_by = p_uid) as is_eigenaar
        from public.group_members gm
        join public.groups g on g.id = gm.group_id
        where gm.player_id = p_uid
        order by g.name
      ) r
    ),
    'matches', (
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
      from (
        select m.id, m.played_at, m.status, m.score_a, m.score_b,
               g.name as groep
        from public.matches m
        join public.teams t on t.id in (m.team_a_id, m.team_b_id)
        left join public.groups g on g.id = m.group_id
        where p_uid in (t.player1_id, t.player2_id)
        order by m.played_at desc nulls last
        limit 10
      ) r
    ),
    -- Gasten die deze gebruiker beheert; die verdwijnen mee als het account
    -- verwijderd wordt (owner_id-cascade), dus dit hoort bij het detail.
    'gasten', (
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
      from (
        select gp.id, gp.username, gp.full_name, gp.created_at
        from public.profiles gp
        where gp.owner_id = p_uid and gp.is_guest
        order by gp.username
      ) r
    ),
    'push_subscripties', (
      select count(*) from public.push_subscriptions ps where ps.user_id = p_uid
    )
  )
  -- De from/where is niet decoratief: zonder deze regel levert de select altijd
  -- precies één rij op — ook voor een id dat niet bestaat — en krijgt de edge
  -- function een keurig gevuld leeg detail in plaats van null. Dan is er geen
  -- 404 meer en lijkt elk willekeurig uuid een bestaand, leeg account.
  from public.profiles p
  where p.id = p_uid;
$$;

revoke execute on function public.admin_user_detail(uuid) from public, anon, authenticated;
grant execute on function public.admin_user_detail(uuid) to service_role;

-- De historie onder het detailpaneel: wat is er met deze gebruiker gedaan, en
-- door wie. actor_id heeft geen foreign key (zie tables/26_app_admins.sql),
-- dus de left join vangt een intussen verwijderde beheerder op.
create or replace function public.admin_audit_voor(p_uid uuid)
returns table (
  id bigint,
  actor_id uuid,
  actor_username text,
  action text,
  details jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select l.id, l.actor_id, ap.username, l.action, l.details, l.created_at
  from public.admin_audit_log l
  left join public.profiles ap on ap.id = l.actor_id
  where l.target_user_id = p_uid
  order by l.created_at desc
  limit 50;
$$;

revoke execute on function public.admin_audit_voor(uuid) from public, anon, authenticated;
grant execute on function public.admin_audit_voor(uuid) to service_role;

-- "Overal uitloggen" voor een ander account (#1036). De admin-API van GoTrue kan
-- dit niet vanaf de serverkant: auth.admin.signOut(jwt) vraagt een geldig
-- access-token ván die gebruiker, en dat heeft een beheerder per definitie niet.
--
-- Sessies verwijderen is het equivalent: auth.refresh_tokens hangt via session_id
-- met on delete cascade aan auth.sessions, dus één delete trekt de keten door.
-- Lopende access-tokens blijven geldig tot ze verlopen (jwt_expiry, één uur) —
-- inherent aan JWT's, niet iets wat hier te forceren valt. Vermeld dat in de UI
-- in plaats van te doen alsof de deur meteen dicht is.
create or replace function public.admin_trek_sessies_in(p_uid uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aantal integer;
begin
  delete from auth.sessions where user_id = p_uid;
  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

revoke execute on function public.admin_trek_sessies_in(uuid) from public, anon, authenticated;
grant execute on function public.admin_trek_sessies_in(uuid) to service_role;
-- Gasten- en groepenoverzicht voor het adminpaneel (#1036 deel 3).
--
-- Beide alleen-lezen en, net als de rest van dit paneel, service-role-only: de
-- edge function admin-users is de enige aanroeper.

-- Gastspelers: wie beheert ze, spelen ze mee, en wacht er een koppelverzoek?
--
-- aantal_matches telt hier hetzelfde als in admin_users_overzicht en bewust niet
-- via player_standings — die view filtert gasten er juist uit.
create or replace function public.admin_gasten_overzicht()
returns table (
  id uuid,
  username text,
  full_name text,
  created_at timestamptz,
  owner_id uuid,
  owner_username text,
  aantal_matches bigint,
  -- Openstaand koppelverzoek (#681), of null. Als jsonb omdat het er meestal
  -- niet is en een handvol losse kolommen dat slecht uitdrukt.
  open_claim jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    g.id,
    g.username,
    g.full_name,
    g.created_at,
    g.owner_id,
    o.username,
    m.n,
    c.claim
  from public.profiles g
  left join public.profiles o on o.id = g.owner_id
  left join lateral (
    select count(*) as n
    from public.matches mt
    join public.teams t on t.id in (mt.team_a_id, mt.team_b_id)
    where mt.status = 'completed' and g.id in (t.player1_id, t.player2_id)
  ) m on true
  left join lateral (
    select jsonb_build_object(
             'player_id', gc.player_id,
             'player_username', p.username,
             'requested_by', gc.requested_by,
             'created_at', gc.created_at
           ) as claim
    from public.guest_claims gc
    join public.profiles p on p.id = gc.player_id
    where gc.guest_id = g.id and gc.status = 'pending'
    limit 1
  ) c on true
  where g.is_guest
  order by o.username nulls first, g.username;
$$;

revoke execute on function public.admin_gasten_overzicht() from public, anon, authenticated;
grant execute on function public.admin_gasten_overzicht() to service_role;

-- Groepen: wie is de eigenaar, hoeveel leden, en wanneer werd er voor het
-- laatst gespeeld.
--
-- eigenaar_username is null als groups.created_by null is. Dat is geen
-- schoonheidsfoutje maar een kapotte groep: created_by is `on delete set null`
-- en alle groepspolicies vergelijken `auth.uid() = created_by`, dus zo'n groep
-- is voor niemand meer te hernoemen, te verwijderen of qua uitslagen te
-- corrigeren. Het paneel zet dat apart in beeld; overdragen komt in #1049.
create or replace function public.admin_groepen_overzicht()
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  created_by uuid,
  eigenaar_username text,
  aantal_leden bigint,
  aantal_matches bigint,
  laatste_match timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    g.id,
    g.name,
    g.created_at,
    g.created_by,
    o.username,
    l.n,
    m.n,
    m.laatste
  from public.groups g
  left join public.profiles o on o.id = g.created_by
  left join lateral (
    select count(*) as n from public.group_members gm where gm.group_id = g.id
  ) l on true
  left join lateral (
    select count(*) as n, max(mt.played_at) as laatste
    from public.matches mt
    where mt.group_id = g.id and mt.status = 'completed'
  ) m on true
  order by m.laatste desc nulls last, g.name;
$$;

revoke execute on function public.admin_groepen_overzicht() from public, anon, authenticated;
grant execute on function public.admin_groepen_overzicht() to service_role;
