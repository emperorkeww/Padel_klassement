-- Helper-functies (SECURITY DEFINER) om RLS-recursie te voorkomen.

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

-- Delen twee spelers minstens één groep? SECURITY DEFINER zodat de friendships-
-- select-policy (#326) dit kan aanroepen zonder afhankelijk te zijn van de RLS
-- op group_members.
create or replace function public.shares_group(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.group_members ga
    join public.group_members gb on gb.group_id = ga.group_id
    where ga.player_id = p_a and gb.player_id = p_b
  );
$$;

-- Speelt p_uid in dit team? Voor de matches-update-policy (#413), zodat
-- deelnemers hun eigen uitslag kunnen invullen. SECURITY DEFINER conform de
-- overige helpers (teams is publiek leesbaar, maar zo blijft de policy
-- onafhankelijk van de RLS op teams).
create or replace function public.is_team_member(p_team_id uuid, p_uid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team_id
      and p_uid in (t.player1_id, t.player2_id)
  );
$$;

-- Bestaat er een geaccepteerde vriendschap tussen twee spelers? SECURITY
-- DEFINER (bypasst RLS) is hier essentieel: de friendships-select-policy (#326)
-- roept dit aan, en een policy die ongefilterd public.friendships bevraagt zou
-- anders oneindig recurseren.
create or replace function public.is_accepted_friend(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = p_a and f.addressee_id = p_b)
        or (f.requester_id = p_b and f.addressee_id = p_a)
      )
  );
$$;