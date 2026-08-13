-- #1271 Mexicano gebruikt de spelerselectie — spiegel van
-- supabase/schemas/functions/10_mexicano.sql; zie dat bestand voor de volledige
-- motivatie.
--
-- Twee dingen gingen mis in dezelfde functie:
--
-- 1. De RPC kende geen spelerslijst en rangschikte álle group_members. De
--    selectie die je op de speeldag maakt ("Wie speelt er mee?") en de meta-rij
--    "8 aan · 1 op de bank" waren daarmee onwaar bij Mexicano: wie afzegde
--    stond gewoon op de baan. Eerlijk en Americano gaven hun lijst wél mee, via
--    create_fair_round(p_players). Mexicano krijgt nu dezelfde parameter — als
--    pool, niet als indeling: de volgorde blijft uit de stand komen.
--
-- 2. De ronde-blokkade keek naar `status <> 'completed'`, en dat is ook waar
--    voor een geannuleerde match. Eén cancelled rij blokkeerde de Mexicano van
--    een groep dus permanent, met een serverfout die nergens op sloeg. De
--    blokkade hoort te gaan over uitslagen die nog moeten komen: 'scheduled'.
--
-- Met de hand geschreven en niet via `supabase db diff`: dat commando draait op
-- develop niet meer door bestaande schema-drift (zie de kop van
-- 20260805120000_1036_adminpaneel.sql). Deze migratie vervangt één functie en
-- is één-op-één na te lezen naast het schemabestand.

-- De oude signatuur eerst weg: `create or replace` maakt van een extra
-- parameter met default een tweede functie in plaats van een vervanging, en
-- dan wordt generate_mexicano_round(uuid, timestamptz) dubbelzinnig.
drop function if exists public.generate_mexicano_round(uuid, timestamptz);

create or replace function public.generate_mexicano_round(
  p_group_id uuid,
  p_played_at timestamptz default null,
  p_players uuid[] default null
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

  if p_players is not null and exists (
    select 1 from unnest(p_players) as pid
    where not public.is_group_member(p_group_id, pid)
  ) then
    raise exception 'Alle spelers moeten lid zijn van deze groep';
  end if;

  -- Ronde-slot: eerst alle uitslagen van de vorige ronde(s) invullen.
  if exists (
    select 1 from public.matches
    where group_id = p_group_id and status = 'scheduled'
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
  where gm.group_id = p_group_id
    and (p_players is null or gm.player_id = any(p_players));

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

grant execute on function public.generate_mexicano_round(uuid, timestamptz, uuid[]) to authenticated;
