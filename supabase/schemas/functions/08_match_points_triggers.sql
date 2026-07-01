-- won_by_team_id moet één van de twee teams van de match zijn. Een check-
-- constraint kan niet naar een andere tabel verwijzen, dus een BEFORE INSERT-trigger.
create or replace function public.match_points_validate_team()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  select new.won_by_team_id in (m.team_a_id, m.team_b_id)
    into v_ok
  from public.matches m
  where m.id = new.match_id;

  if not coalesce(v_ok, false) then
    raise exception 'won_by_team_id moet team_a of team_b van de match zijn';
  end if;
  return new;
end;
$$;

create trigger match_points_validate_team
  before insert on public.match_points
  for each row execute function public.match_points_validate_team();