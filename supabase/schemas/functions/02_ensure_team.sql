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
