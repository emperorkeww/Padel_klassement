-- Sociale laag + groepen + Americano + speler-/groepsklassement.
-- Bouwt voort op profiles/teams/matches/standings uit eerdere migraties.

------------------------------------------------------------------------
-- 1) Vriendschappen (verzoek -> accepteren/weigeren, wederzijds)
------------------------------------------------------------------------
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_distinct check (requester_id <> addressee_id)
);

-- Eén relatie per paar, ongeacht wie het verzoek stuurde.
create unique index friendships_unique_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index friendships_addressee_idx on public.friendships (addressee_id);

------------------------------------------------------------------------
-- 2) Groepen + leden
------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, player_id)
);

------------------------------------------------------------------------
-- 3) Matches uitbreiden: koppeling aan groep/ronde + eindscore
------------------------------------------------------------------------
alter table public.matches
  add column group_id uuid references public.groups (id) on delete set null,
  add column round_number smallint,
  add column score_a smallint,
  add column score_b smallint;

create index matches_group_idx on public.matches (group_id);

------------------------------------------------------------------------
-- 4) Helper-functies (SECURITY DEFINER) — voorkomen RLS-recursie
------------------------------------------------------------------------
create or replace function public.is_group_member(p_group_id uuid, p_uid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.player_id = p_uid
  );
$$;

create or replace function public.is_group_owner(p_group_id uuid, p_uid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.created_by = p_uid
  );
$$;

-- Vindt een bestaand team voor een (ongeordend) spelerspaar of maakt het aan.
create or replace function public._ensure_team(p_a uuid, p_b uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.teams
  where least(player1_id, player2_id) = least(p_a, p_b)
    and greatest(player1_id, player2_id) = greatest(p_a, p_b);

  if v_id is null then
    insert into public.teams (player1_id, player2_id)
    values (p_a, p_b)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function public._ensure_team(uuid, uuid) from public;

------------------------------------------------------------------------
-- 5) Trigger: maker van een groep wordt automatisch owner-lid
------------------------------------------------------------------------
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.group_members (group_id, player_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

------------------------------------------------------------------------
-- 6) RPC: Americano-ronde genereren (wisselende partners)
------------------------------------------------------------------------
create or replace function public.generate_americano_round(p_group_id uuid)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_round smallint;
  v_players uuid[];
  v_n int;
  v_i int;
  v_team_a uuid;
  v_team_b uuid;
  v_match_id uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'Geen toegang tot deze groep';
  end if;

  select coalesce(max(round_number), 0) + 1 into v_round
  from public.matches
  where group_id = p_group_id;

  select array_agg(player_id order by random())
  into v_players
  from public.group_members
  where group_id = p_group_id;

  v_n := coalesce(array_length(v_players, 1), 0);
  if v_n < 4 then
    raise exception 'Minimaal 4 spelers nodig voor een Americano-ronde (nu %).', v_n;
  end if;

  -- Vorm zoveel mogelijk courts van 4 spelers (2 vs 2). Overige 1-3 spelers
  -- zitten deze ronde op de bank.
  v_i := 1;
  while v_i + 3 <= v_n loop
    v_team_a := public._ensure_team(v_players[v_i], v_players[v_i + 1]);
    v_team_b := public._ensure_team(v_players[v_i + 2], v_players[v_i + 3]);

    insert into public.matches (team_a_id, team_b_id, status, group_id, round_number, created_by)
    values (v_team_a, v_team_b, 'scheduled', p_group_id, v_round, v_uid)
    returning id into v_match_id;

    return next v_match_id;
    v_i := v_i + 4;
  end loop;

  return;
end;
$$;

grant execute on function public.generate_americano_round(uuid) to authenticated;

------------------------------------------------------------------------
-- 7) RPC: een afgeronde match loggen (4 spelers -> teams -> resultaat)
------------------------------------------------------------------------
create or replace function public.create_completed_match(
  p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_winner text,
  p_score_a smallint default null,
  p_score_b smallint default null,
  p_group_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_a uuid;
  v_team_b uuid;
  v_winner uuid;
  v_match uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_winner not in ('a', 'b') then
    raise exception 'Winnaar moet ''a'' of ''b'' zijn';
  end if;
  if p_a1 is null or p_a2 is null or p_b1 is null or p_b2 is null then
    raise exception 'Vier spelers vereist';
  end if;
  -- alle vier spelers moeten verschillend zijn
  if p_a1 in (p_a2, p_b1, p_b2) or p_a2 in (p_b1, p_b2) or p_b1 = p_b2 then
    raise exception 'De vier spelers moeten verschillend zijn';
  end if;

  v_team_a := public._ensure_team(p_a1, p_a2);
  v_team_b := public._ensure_team(p_b1, p_b2);
  v_winner := case when p_winner = 'a' then v_team_a else v_team_b end;

  insert into public.matches (
    team_a_id, team_b_id, status, winner_team_id,
    score_a, score_b, played_at, created_by, group_id
  )
  values (
    v_team_a, v_team_b, 'completed', v_winner,
    p_score_a, p_score_b, now(), v_uid, p_group_id
  )
  returning id into v_match;

  return v_match;
end;
$$;

grant execute on function public.create_completed_match(uuid, uuid, uuid, uuid, text, smallint, smallint, uuid) to authenticated;

------------------------------------------------------------------------
-- 8) Views: speler- en groepsklassement (win = 3 punten)
------------------------------------------------------------------------
create view public.player_standings
with (security_invoker = true) as
with team_results as (
  select team_a_id as team_id, winner_team_id from public.matches where status = 'completed'
  union all
  select team_b_id as team_id, winner_team_id from public.matches where status = 'completed'
),
player_team as (
  select id as team_id, player1_id as player_id from public.teams
  union all
  select id as team_id, player2_id as player_id from public.teams
)
select
  p.id                                                        as player_id,
  p.username,
  p.full_name,
  count(*)                                                    as played,
  count(*) filter (where tr.winner_team_id = tr.team_id)      as won,
  count(*) filter (where tr.winner_team_id is not null
                     and tr.winner_team_id <> tr.team_id)     as lost,
  count(*) filter (where tr.winner_team_id = tr.team_id) * 3  as points
from team_results tr
join player_team pt on pt.team_id = tr.team_id
join public.profiles p on p.id = pt.player_id
group by p.id, p.username, p.full_name;

create view public.group_player_standings
with (security_invoker = true) as
with team_results as (
  select group_id, team_a_id as team_id, winner_team_id
  from public.matches where status = 'completed' and group_id is not null
  union all
  select group_id, team_b_id as team_id, winner_team_id
  from public.matches where status = 'completed' and group_id is not null
),
player_team as (
  select id as team_id, player1_id as player_id from public.teams
  union all
  select id as team_id, player2_id as player_id from public.teams
)
select
  tr.group_id,
  p.id                                                        as player_id,
  p.username,
  p.full_name,
  count(*)                                                    as played,
  count(*) filter (where tr.winner_team_id = tr.team_id)      as won,
  count(*) filter (where tr.winner_team_id is not null
                     and tr.winner_team_id <> tr.team_id)     as lost,
  count(*) filter (where tr.winner_team_id = tr.team_id) * 3  as points
from team_results tr
join player_team pt on pt.team_id = tr.team_id
join public.profiles p on p.id = pt.player_id
group by tr.group_id, p.id, p.username, p.full_name;

------------------------------------------------------------------------
-- 9) RLS
------------------------------------------------------------------------
alter table public.friendships enable row level security;

create policy "Eigen vriendschappen zijn leesbaar"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "Verzoek sturen als verzoeker"
  on public.friendships for insert
  to authenticated
  with check ((select auth.uid()) = requester_id);

create policy "Ontvanger kan verzoek beantwoorden"
  on public.friendships for update
  to authenticated
  using ((select auth.uid()) = addressee_id)
  with check ((select auth.uid()) = addressee_id);

create policy "Betrokkene kan vriendschap verwijderen"
  on public.friendships for delete
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

alter table public.groups enable row level security;

create policy "Groepen van leden zijn leesbaar"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id, (select auth.uid()))
         or created_by = (select auth.uid()));

create policy "Gebruiker kan groep aanmaken"
  on public.groups for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

create policy "Eigenaar kan groep bijwerken"
  on public.groups for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "Eigenaar kan groep verwijderen"
  on public.groups for delete
  to authenticated
  using ((select auth.uid()) = created_by);

alter table public.group_members enable row level security;

create policy "Groepsleden zijn zichtbaar voor leden"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "Eigenaar kan leden toevoegen"
  on public.group_members for insert
  to authenticated
  with check (public.is_group_owner(group_id, (select auth.uid())));

create policy "Eigenaar of lid zelf kan verwijderen"
  on public.group_members for delete
  to authenticated
  using (public.is_group_owner(group_id, (select auth.uid()))
         or player_id = (select auth.uid()));
