-- Gastspelers: log een match met iemand die (nog) geen app-account heeft, door
-- gewoon een naam in te vullen. Een gast is een gewone profiles-rij met
-- is_guest = true en een owner_id (de speler die de gast aanmaakte), zonder
-- auth.users-koppeling. Zo blijven teams, match_points, scores en de
-- Elo/standings-pipeline volledig ongewijzigd werken.

-- 1) profiles: gast-vlag + eigenaar, en de auth.users-FK versoepelen (een gast
--    heeft geen auth-account). De cascade-delete van een profiel bij het
--    verwijderen van de auth-gebruiker behouden we via een trigger.
alter table public.profiles
  add column if not exists is_guest boolean not null default false,
  add column if not exists owner_id uuid references auth.users (id) on delete cascade;

alter table public.profiles drop constraint if exists profiles_id_fkey;

-- Een gast heeft altijd een eigenaar; een echte gebruiker nooit.
alter table public.profiles drop constraint if exists profiles_guest_owner_chk;
alter table public.profiles
  add constraint profiles_guest_owner_chk check (is_guest = (owner_id is not null));

-- Behoud het gedrag van de weggevallen FK: verwijder het profiel wanneer de
-- bijhorende auth-gebruiker verdwijnt.
create or replace function public.handle_deleted_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_deleted_user();

-- 2) Is p_player een gast van p_owner? (voor de vrienden-check in de match-RPC's)
create or replace function public.is_own_guest(p_owner uuid, p_player uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = p_player and is_guest and owner_id = p_owner
  );
$$;

-- 3) Maak een gastspeler aan (eigendom van de ingelogde gebruiker). Genereert
--    een unieke username uit de naam; de naam zelf komt in full_name.
create or replace function public.create_guest_player(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := nullif(trim(p_name), '');
  v_base text;
  v_username text;
  v_suffix int := 0;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if v_name is null then
    raise exception 'Geef een naam op voor de gast';
  end if;

  v_base := 'gast_' || regexp_replace(lower(v_name), '[^a-z0-9]+', '_', 'g');
  v_base := trim(both '_' from v_base);
  if v_base is null or v_base = '' then
    v_base := 'gast';
  end if;

  v_username := v_base;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_suffix := v_suffix + 1;
    v_username := v_base || v_suffix;
  end loop;

  insert into public.profiles (
    id, username, full_name, is_guest, owner_id, discoverable, allow_friend_requests
  )
  values (
    gen_random_uuid(), v_username, v_name, true, v_uid, false, false
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_guest_player(text) to authenticated;

-- 4) De match-RPC's: naast jezelf en je vrienden mag nu ook je eigen gast in de
--    match. (Alleen deze twee toegangscontroles wijzigen; de rest ongemoeid.)
create or replace function public.create_completed_match(
  p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_winner text,
  p_score_a smallint default null,
  p_score_b smallint default null,
  p_group_id uuid default null,
  p_set_scores jsonb default null
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
  if p_winner not in ('a', 'b', 'draw') then
    raise exception 'Winnaar moet ''a'', ''b'' of ''draw'' zijn';
  end if;
  if p_a1 is null or p_a2 is null or p_b1 is null or p_b2 is null then
    raise exception 'Vier spelers vereist';
  end if;
  if p_a1 in (p_a2, p_b1, p_b2) or p_a2 in (p_b1, p_b2) or p_b1 = p_b2 then
    raise exception 'De vier spelers moeten verschillend zijn';
  end if;

  -- Alleen jezelf, je vrienden of je eigen gasten mogen in de match.
  if not (p_a1 = v_uid or public.are_friends(v_uid, p_a1) or public.is_own_guest(v_uid, p_a1))
     or not (p_a2 = v_uid or public.are_friends(v_uid, p_a2) or public.is_own_guest(v_uid, p_a2))
     or not (p_b1 = v_uid or public.are_friends(v_uid, p_b1) or public.is_own_guest(v_uid, p_b1))
     or not (p_b2 = v_uid or public.are_friends(v_uid, p_b2) or public.is_own_guest(v_uid, p_b2)) then
    raise exception 'Je kunt alleen jezelf, je vrienden en je eigen gasten aan een match toevoegen';
  end if;

  v_team_a := public._ensure_team(p_a1, p_a2);
  v_team_b := public._ensure_team(p_b1, p_b2);
  v_winner := case p_winner
                when 'a' then v_team_a
                when 'b' then v_team_b
                else null
              end;

  insert into public.matches (
    team_a_id, team_b_id, status, winner_team_id,
    score_a, score_b, set_scores, played_at, created_by, group_id
  )
  values (
    v_team_a, v_team_b, 'completed', v_winner,
    p_score_a, p_score_b, p_set_scores, now(), v_uid, p_group_id
  )
  returning id into v_match;

  return v_match;
end;
$$;

create or replace function public.create_planned_match(
  p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_played_at timestamptz default null,
  p_group_id uuid default null,
  p_set_scores jsonb default null
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
  v_match uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_a1 is null or p_a2 is null or p_b1 is null or p_b2 is null then
    raise exception 'Vier spelers vereist';
  end if;
  if p_a1 in (p_a2, p_b1, p_b2) or p_a2 in (p_b1, p_b2) or p_b1 = p_b2 then
    raise exception 'De vier spelers moeten verschillend zijn';
  end if;

  -- Alleen jezelf, je vrienden of je eigen gasten mogen in de match.
  if not (p_a1 = v_uid or public.are_friends(v_uid, p_a1) or public.is_own_guest(v_uid, p_a1))
     or not (p_a2 = v_uid or public.are_friends(v_uid, p_a2) or public.is_own_guest(v_uid, p_a2))
     or not (p_b1 = v_uid or public.are_friends(v_uid, p_b1) or public.is_own_guest(v_uid, p_b1))
     or not (p_b2 = v_uid or public.are_friends(v_uid, p_b2) or public.is_own_guest(v_uid, p_b2)) then
    raise exception 'Je kunt alleen jezelf, je vrienden en je eigen gasten aan een match toevoegen';
  end if;

  v_team_a := public._ensure_team(p_a1, p_a2);
  v_team_b := public._ensure_team(p_b1, p_b2);

  insert into public.matches (
    team_a_id, team_b_id, status, played_at, created_by, group_id
  )
  values (
    v_team_a, v_team_b, 'scheduled', p_played_at, v_uid, p_group_id
  )
  returning id into v_match;

  return v_match;
end;
$$;

-- 5) Gasten weren uit het spelersklassement (ze kunnen niet inloggen en horen
--    niet in de globale ranglijst). Hun matches blijven wel meetellen voor de
--    échte spelers, want die rijen worden apart geaggregeerd.
create or replace view public.player_standings
with (security_invoker = true) as
with team_results as (
  select team_a_id as team_id, winner_team_id,
         score_a as scored_for, score_b as scored_against
  from public.matches where status = 'completed'
  union all
  select team_b_id as team_id, winner_team_id,
         score_b as scored_for, score_a as scored_against
  from public.matches where status = 'completed'
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
  count(*) filter (where tr.winner_team_id is null)           as drawn,
  count(*) filter (where tr.winner_team_id is not null
                     and tr.winner_team_id <> tr.team_id)     as lost,
  count(*) filter (where tr.winner_team_id = tr.team_id) * 3
    + count(*) filter (where tr.winner_team_id is null)       as points,
  coalesce(sum(coalesce(tr.scored_for, 0)
             - coalesce(tr.scored_against, 0)), 0)            as goal_diff
from team_results tr
join player_team pt on pt.team_id = tr.team_id
join public.profiles p on p.id = pt.player_id
where not p.is_guest
group by p.id, p.username, p.full_name;

-- 6) Gasten nooit als vriendsuggestie voorstellen.
create or replace function public.get_friend_suggestions(p_limit int default 12)
returns table (id uuid, mutual_count int, mutual_ids uuid[])
language sql
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as uid),
  my_friends as (
    select case when f.requester_id = m.uid then f.addressee_id else f.requester_id end as friend_id
    from public.friendships f, me m
    where f.status = 'accepted' and m.uid in (f.requester_id, f.addressee_id)
  ),
  related as (
    select case when f.requester_id = m.uid then f.addressee_id else f.requester_id end as rid
    from public.friendships f, me m
    where m.uid in (f.requester_id, f.addressee_id)
  ),
  fof as (
    select case when f.requester_id = mf.friend_id then f.addressee_id else f.requester_id end as cand,
           count(*)::int as mutual,
           array_agg(mf.friend_id) as mutual_ids
    from public.friendships f
    join my_friends mf on mf.friend_id in (f.requester_id, f.addressee_id)
    where f.status = 'accepted'
    group by 1
  )
  select p.id,
         coalesce(fof.mutual, 0) as mutual_count,
         coalesce(fof.mutual_ids, '{}') as mutual_ids
  from public.profiles p
  left join fof on fof.cand = p.id
  where p.id <> (select uid from me)
    and not p.is_guest
    and p.id not in (select rid from related)
  order by mutual_count desc, random()
  limit p_limit;
$$;

grant execute on function public.get_friend_suggestions(int) to authenticated;

-- 7) Een eigenaar mag ook zijn eigen gast als groepslid toevoegen, zodat gasten
--    meedoen in gegenereerde rondes (die putten uit group_members).
drop policy if exists "Eigenaar kan vrienden toevoegen" on public.group_members;
create policy "Eigenaar kan vrienden toevoegen"
  on public.group_members for insert
  to authenticated
  with check (
    public.is_group_owner(group_id, (select auth.uid()))
    and (
      player_id = (select auth.uid())
      or public.are_friends((select auth.uid()), player_id)
      or public.is_own_guest((select auth.uid()), player_id)
    )
  );
