-- RPC: genereer een Americano-ronde met wisselende partners voor een groep.
-- p_played_at is het (optionele) starttijdstip van de ronde (#827): bij een
-- gelockte speeldag-poll is dat de echte starttijd, anders null zoals voorheen.
create or replace function public.generate_americano_round(
  p_group_id uuid,
  p_played_at timestamptz default null
)
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

    insert into public.matches (team_a_id, team_b_id, status, group_id, round_number, created_by, played_at)
    values (v_team_a, v_team_b, 'scheduled', p_group_id, v_round, v_uid, p_played_at)
    returning id into v_match_id;

    return next v_match_id;
    v_i := v_i + 4;
  end loop;

  return;
end;
$$;

grant execute on function public.generate_americano_round(uuid, timestamptz) to authenticated;