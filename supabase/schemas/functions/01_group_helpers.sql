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