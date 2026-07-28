-- Lef-tip (#804): guards op match_stakes. De multiplier zelf zit in de
-- Elo-kern (09_ratings.sql); hier wordt alleen bewaakt wie wanneer mag
-- inzetten. Spiegel van match_predictions_guard (19_match_predictions.sql).

-- Guard: inzetten kan alleen op een nog niet gestarte, geplande groepsmatch
-- waarin je zelf meespeelt, en alleen met een ingelopen rating. De speeldag
-- wordt hier gezet, nooit door de client — die kolom draagt het tegoed.
create or replace function public.match_stakes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Clubtijd, dezelfde constante als de Edge Functions (snapshot-availability,
  -- poll-deadline) en dayInZone in de client.
  tz constant text := 'Europe/Brussels';
  -- Drempel tegen het verdubbelen van een nog niet ingelopen rating. E[Δ] = 0
  -- geldt alleen als E de wérkelijke winkans is; een nieuwe speler start op
  -- 1000, dus een sterke nieuwkomer (E ≈ 0,24 bij een echte kans van ~0,64)
  -- zou zijn onderwaardering anders verdubbeld verzilveren.
  min_games constant int := 10;
  m record;
begin
  select id, group_id, status, played_at, team_a_id, team_b_id
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;
  if m.group_id is null or m.group_id is distinct from new.group_id then
    raise exception 'een lef-tip kan alleen op groepsmatches';
  end if;
  if m.status <> 'scheduled' then
    raise exception 'deze match is al begonnen of afgerond';
  end if;
  -- Zonder starttijd is er geen speeldag, en dus geen tegoed om op af te
  -- rekenen; zo'n match is niet inzetbaar.
  if m.played_at is null then
    raise exception 'deze match heeft nog geen starttijd';
  end if;
  if m.played_at <= now() then
    raise exception 'de match is al begonnen';
  end if;
  if not (
       public.is_team_member(m.team_a_id, new.player_id)
       or public.is_team_member(m.team_b_id, new.player_id)
     ) then
    raise exception 'alleen spelers uit deze match kunnen inzetten';
  end if;
  if coalesce(
       (select games from public.player_ratings where player_id = new.player_id),
       0
     ) < min_games then
    raise exception
      'je rating is nog niet ingelopen: inzetten kan vanaf % gespeelde matches',
      min_games;
  end if;

  new.play_date := (m.played_at at time zone tz)::date;
  return new;
end;
$$;

create trigger match_stakes_guard
  before insert or update on public.match_stakes
  for each row execute function public.match_stakes_guard();

-- Een inzet intrekken kan alleen zolang de match niet gestart of afgerond is.
-- Cascade-deletes (match of groep verwijderd) lopen via de RI-triggers en
-- mogen altijd door: die draaien op trigger-diepte > 1, een directe delete van
-- een gebruiker op diepte 1. Zelfde patroon als match_predictions.
create or replace function public.match_stakes_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  if pg_trigger_depth() > 1 then
    return old; -- cascade (match of groep verwijderd): altijd toestaan
  end if;
  select status, played_at into m from public.matches where id = old.match_id;
  if not found then
    return old; -- match al verwijderd
  end if;
  if m.status <> 'scheduled' or (m.played_at is not null and m.played_at <= now()) then
    raise exception 'je inzet staat vast: de match is al begonnen of afgerond';
  end if;
  return old;
end;
$$;

create trigger match_stakes_delete_guard
  before delete on public.match_stakes
  for each row execute function public.match_stakes_delete_guard();

-- Elo-multiplier van één speler op één match: 2 als hij ingezet heeft, anders
-- 1. Bij een gelijkspel (geen winnaar) telt de inzet niet mee — K · (0,5 − E)
-- is voor een underdog positief en mag geen beloning voor een mislukte tip
-- worden. Wordt uitsluitend door de Elo-kern aangeroepen (09_ratings.sql);
-- omdat de uitkomst puur uit opgeslagen data volgt, geeft recompute_ratings()
-- exact hetzelfde resultaat als het incrementele pad.
create or replace function public._stake_factor(
  p_player uuid,
  p_match uuid,
  p_has_winner boolean
)
returns numeric
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when p_has_winner and exists (
      select 1
      from public.match_stakes s
      where s.match_id = p_match and s.player_id = p_player
    ) then 2.0
    else 1.0
  end;
$$;

revoke execute on function public._stake_factor(uuid, uuid, boolean) from public;
