-- RPC: genereer een Mexicano-ronde voor een groep.
--
-- Verschil met Americano: de partners/tegenstanders worden niet willekeurig
-- gekozen maar op basis van de huidige stand. Spelers worden gerangschikt op
-- punten (en saldo), en per court van 4 speelt rang 1&4 tegen 2&3 — zo spelen
-- gelijkwaardige spelers tegen elkaar.
--
-- Blokkade: er mag geen onafgeronde match meer openstaan in de groep. Anders
-- zou de volgende ronde op een halve (onvolledige) stand gepaird worden.
--
-- p_played_at is het (optionele) starttijdstip van de ronde (#827): bij een
-- gelockte speeldag-poll is dat de echte starttijd, anders null zoals voorheen.
create or replace function public.generate_mexicano_round(
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

  -- Ronde-slot: eerst alle uitslagen van de vorige ronde(s) invullen.
  if exists (
    select 1 from public.matches
    where group_id = p_group_id and status <> 'completed'
  ) then
    raise exception 'Vul eerst alle uitslagen van de vorige ronde in voordat je een nieuwe Mexicano-ronde genereert.';
  end if;

  select coalesce(max(round_number), 0) + 1 into v_round
  from public.matches
  where group_id = p_group_id;

  -- Rangschik de leden op stand (punten desc, saldo desc). Spelers zonder
  -- afgeronde match krijgen 0 en vallen via de random-tiebreak willekeurig mee.
  select array_agg(gm.player_id order by coalesce(s.points, 0) desc, coalesce(s.goal_diff, 0) desc, random())
  into v_players
  from public.group_members gm
  left join (
    select pt.player_id,
           sum(case when tr.winner_team_id = tr.team_id then 3
                    when tr.winner_team_id is null then 1
                    else 0 end)                                    as points,
           sum(coalesce(tr.scored_for, 0) - coalesce(tr.scored_against, 0)) as goal_diff
    from (
      select team_a_id as team_id, winner_team_id,
             score_a as scored_for, score_b as scored_against
      from public.matches
      where group_id = p_group_id and status = 'completed'
      union all
      select team_b_id, winner_team_id, score_b, score_a
      from public.matches
      where group_id = p_group_id and status = 'completed'
    ) tr
    join (
      select id as team_id, player1_id as player_id from public.teams
      union all
      -- singles-teams hebben geen tweede speler
      select id, player2_id from public.teams where player2_id is not null
    ) pt on pt.team_id = tr.team_id
    group by pt.player_id
  ) s on s.player_id = gm.player_id
  where gm.group_id = p_group_id;

  v_n := coalesce(array_length(v_players, 1), 0);
  if v_n < 4 then
    raise exception 'Minimaal 4 spelers nodig voor een Mexicano-ronde (nu %).', v_n;
  end if;

  -- Per court van 4 gerangschikte spelers: 1&4 tegen 2&3. Overige 1-3 spelers
  -- zitten deze ronde op de bank.
  v_i := 1;
  while v_i + 3 <= v_n loop
    v_team_a := public._ensure_team(v_players[v_i], v_players[v_i + 3]);
    v_team_b := public._ensure_team(v_players[v_i + 1], v_players[v_i + 2]);

    insert into public.matches (team_a_id, team_b_id, status, group_id, round_number, created_by, played_at)
    values (v_team_a, v_team_b, 'scheduled', p_group_id, v_round, v_uid, p_played_at)
    returning id into v_match_id;

    return next v_match_id;
    v_i := v_i + 4;
  end loop;

  return;
end;
$$;

grant execute on function public.generate_mexicano_round(uuid, timestamptz) to authenticated;
