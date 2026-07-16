-- Smoesjes (#296): guard voor match_smoesjes. Een smoes plaatsen kan alleen op
-- een afgeronde groepsmatch, met een group_id die echt bij de match hoort, en
-- alleen door een speler die die match ook écht verloor (server-side spiegel van
-- de iLost-gate in de UI). updated_at wordt hier gezet, nooit door de client.
create or replace function public.match_smoesjes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_loser uuid;
  l record;
begin
  select id, group_id, status, winner_team_id, team_a_id, team_b_id
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;
  if m.group_id is null or m.group_id is distinct from new.group_id then
    raise exception 'een smoes plaatsen kan alleen op groepsmatches';
  end if;
  if m.status <> 'completed' then
    raise exception 'deze match is nog niet afgerond';
  end if;
  if m.winner_team_id is null then
    raise exception 'bij een gelijkspel valt er niets goed te praten';
  end if;

  -- Het verliezende team en de vraag of de speler daarin zat.
  v_loser := case when m.winner_team_id = m.team_a_id then m.team_b_id else m.team_a_id end;
  select player1_id, player2_id into l from public.teams where id = v_loser;
  -- "not in (..., null)" evalueert naar null en zou de guard stil passeren
  -- bij een singles-team; daarom expliciet "is distinct from".
  if new.player_id <> l.player1_id and new.player_id is distinct from l.player2_id then
    raise exception 'alleen wie de match verloor mag een smoes plaatsen';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger match_smoesjes_guard
  before insert or update on public.match_smoesjes
  for each row execute function public.match_smoesjes_guard();
