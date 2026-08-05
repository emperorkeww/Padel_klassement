-- #1036 Adminpaneel — fundament: de beheerdersrol, het auditspoor en de
-- leesfuncties waarop /admin draait. Spiegel van de nieuwe
-- supabase/schemas/tables/26_app_admins.sql, functions/37_app_admin.sql en
-- policies/app_admins.sql; zie die bestanden voor de volledige motivatie.
--
-- Met de hand geschreven in plaats van via `supabase db diff`. Dat commando
-- draait op develop namelijk helemaal niet meer: het declaratieve schema is op
-- twee punten uit de pas gelopen met de migraties (profiles.notify_rank_change
-- ontbreekt in schemas/tables/01_profiles.sql terwijl policies/profiles.sql hem
-- wél grant, en public.dictator_termijnen staat enkel in de migraties maar wordt
-- in policies/zz_client_read_grants.sql aangehaald). Die drift opruimen hoort in
-- een eigen issue en niet hier; deze migratie voegt uitsluitend nieuwe objecten
-- toe, dus ze is één-op-één na te lezen naast de schemabestanden.

-- 1. Tabellen ---------------------------------------------------------------

-- Bewust een aparte tabel en géén vlag op profiles: die tabel is publiek
-- leesbaar en client-schrijfbaar (kolom-grant, #465). Een rol als kolom zou aan
-- iedereen verraden wie beheerder is en zou meeliften zodra die grant-lijst ooit
-- verruimd wordt.
create table public.app_admins (
  user_id uuid primary key references auth.users on delete cascade,
  note text,
  added_at timestamptz not null default now()
);

-- Geen foreign keys op actor_id/target_user_id: een auditrij moet juist blijven
-- staan als het doelaccount verdwijnt — dat is de interessantste rij van
-- allemaal, en een cascade zou het bewijs mee de afgrond in nemen.
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action text not null,
  target_user_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_target_idx
  on public.admin_audit_log (target_user_id, created_at desc);

-- 2. RLS en grants ----------------------------------------------------------

-- RLS aan zonder policies, en dat is opzet: "geen policy" betekent "geen enkele
-- rij". De revokes zijn de tweede laag — PostgREST heeft naast een policy ook
-- een tabelgrant nodig. Supabase geeft nieuwe tabellen standaard grants aan
-- anon/authenticated mee (default privileges), dus dit moet expliciet weg in
-- plaats van weggelaten. Deze twee tabellen komen daarom óók niet in
-- policies/zz_client_read_grants.sql te staan.
alter table public.app_admins enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on table public.app_admins from authenticated, anon;
revoke all on table public.admin_audit_log from authenticated, anon;

-- Expliciet in plaats van op de default privileges vertrouwen: de gepinde
-- CLI-versie in ci.yml bestaat juist omdat die defaults tussen versies
-- verschuiven.
grant select, insert, delete on table public.app_admins to service_role;
grant select, insert on table public.admin_audit_log to service_role;

-- 3. Functies ---------------------------------------------------------------

-- Zelfde vorm als de helpers in schemas/functions/01_group_helpers.sql. p_uid is
-- verplicht: een `default (select auth.uid())` zoals in de issuetekst is geen
-- geldige SQL (subqueries mogen niet in een DEFAULT-expressie), en een
-- `default auth.uid()` zou met search_path = '' in de context van de aanroeper
-- geëvalueerd worden. De enige aanroeper is de edge function, die het id heeft.
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

-- De gebruikerslijst. Dit is een RPC en geen PostgREST-query omdat het
-- auth-schema niet in config.toml's `schemas`-lijst staat: PostgREST kan er niet
-- bij, ook niet met de service-role key. En dat moet zo blijven — auth.users
-- heeft geen RLS, dus het schema exposeren zou elk e-mailadres en elke
-- wachtwoordhash achter de API hangen. Een security-definer-functie in public is
-- de enige brug, en scheelt en passant een N+1 op de tellingen.
--
-- aantal_matches wordt hier zelf geteld en komt bewust NIET uit de view
-- player_standings: die filtert `where not p.is_guest`, dus een gast met twintig
-- matches zou op 0 staan — precies de kolom waarop je in het gasten-tabblad
-- afgaat.
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
-- door wie. actor_id heeft geen foreign key, dus de left join vangt een
-- intussen verwijderde beheerder op.
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
