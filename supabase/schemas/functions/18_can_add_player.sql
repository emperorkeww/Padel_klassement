-- Toegangscheck voor het loggen/plannen van een match: mag p_player door p_uid
-- worden toegevoegd? Jezelf, een vriend, je eigen gast, of — als er een groep is
-- opgegeven — een medelid van die groep. Gebruikt door create_completed_match
-- en create_planned_match.
create or replace function public._can_add_player(
  p_uid uuid, p_player uuid, p_group_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select p_player = p_uid
      or public.are_friends(p_uid, p_player)
      or public.is_own_guest(p_uid, p_player)
      or (p_group_id is not null and public.is_group_member(p_group_id, p_player));
$$;

revoke execute on function public._can_add_player(uuid, uuid, uuid) from public;
