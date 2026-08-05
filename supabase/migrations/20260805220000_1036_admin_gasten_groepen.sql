-- #1036 Adminpaneel deel 3: de tabbladen Gasten en Groepen.
--
-- Twee alleen-lezen overzichts-RPC's, service-role-only zoals de rest van het
-- paneel. Spiegel van supabase/schemas/functions/37_app_admin.sql.
--
-- Met de hand geschreven; `supabase db diff` draait op develop niet door de
-- schemadrift van #825.

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
