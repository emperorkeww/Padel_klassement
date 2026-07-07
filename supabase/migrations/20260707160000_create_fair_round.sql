-- RPC: schrijf een "Eerlijke teams"-voorstel weg als speelbare geplande matches.
-- p_players is een platte lijst van spelers, per baan vier op een rij:
--   [a1, a2, b1, b2,  a1, a2, b1, b2, ...]
-- Team A = de eerste twee van elk viertal, team B = de laatste twee.
-- Zo wordt "RSVP -> eerlijke teams -> uitslag" één doorlopende flow: dezelfde
-- vorm als generate_americano_round, maar met de door FairTeams gekozen vaste
-- teams i.p.v. een willekeurige indeling.
create or replace function public.create_fair_round(
  p_group_id uuid,
  p_players uuid[]
)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_round smallint;
  v_n int := coalesce(array_length(p_players, 1), 0);
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
  if v_n < 4 or v_n % 4 <> 0 then
    raise exception 'Aantal spelers moet een veelvoud van 4 zijn (nu %).', v_n;
  end if;

  -- Alle opgegeven spelers moeten lid zijn van de groep.
  if exists (
    select 1 from unnest(p_players) as pid
    where not public.is_group_member(p_group_id, pid)
  ) then
    raise exception 'Alle spelers moeten lid zijn van deze groep';
  end if;

  select coalesce(max(round_number), 0) + 1 into v_round
  from public.matches
  where group_id = p_group_id;

  v_i := 1;
  while v_i + 3 <= v_n loop
    if p_players[v_i] in (p_players[v_i + 1], p_players[v_i + 2], p_players[v_i + 3])
       or p_players[v_i + 1] in (p_players[v_i + 2], p_players[v_i + 3])
       or p_players[v_i + 2] = p_players[v_i + 3] then
      raise exception 'De vier spelers per baan moeten verschillend zijn';
    end if;

    v_team_a := public._ensure_team(p_players[v_i], p_players[v_i + 1]);
    v_team_b := public._ensure_team(p_players[v_i + 2], p_players[v_i + 3]);

    insert into public.matches (team_a_id, team_b_id, status, group_id, round_number, created_by)
    values (v_team_a, v_team_b, 'scheduled', p_group_id, v_round, v_uid)
    returning id into v_match_id;

    return next v_match_id;
    v_i := v_i + 4;
  end loop;

  return;
end;
$$;

grant execute on function public.create_fair_round(uuid, uuid[]) to authenticated;
