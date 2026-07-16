-- Vindt een bestaand team voor een (ongeordend) spelerspaar of maakt het aan.
-- Voor singles (1v1) is p_b null: least/greatest negeren nulls, dus de lookup
-- vindt het singles-team van p_a ongewijzigd terug.
create or replace function public._ensure_team(p_a uuid, p_b uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- player1_id is not null; zorg dat de gevulde speler altijd in slot 1 zit.
  if p_a is null then
    p_a := p_b;
    p_b := null;
  end if;

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
