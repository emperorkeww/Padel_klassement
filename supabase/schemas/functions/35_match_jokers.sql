-- Maandelijkse jokers (#1003): guards op match_jokers en de factor die de
-- Elo-kern (09_ratings.sql) eruit afleidt. Spiegel van 30_match_stakes.sql —
-- dezelfde poort, hetzelfde tegoed-mechanisme, alleen per maand in plaats van
-- per speeldag.

-- Guard: een joker uitspelen kan alleen op een nog niet gestarte, geplande
-- groepsmatch waarin je zelf meespeelt. De maand wordt hier gezet, nooit door
-- de client — die kolom draagt het tegoed.
create or replace function public.match_jokers_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Clubtijd, dezelfde constante als match_stakes_guard, de Edge Functions en
  -- dayInZone in de client.
  tz constant text := 'Europe/Brussels';
  -- Zelfde drempel als de lef-tip, en om dezelfde reden: E[Δ] = 0 geldt alleen
  -- als E de wérkelijke winkans is. Een sterke nieuwkomer staat op 1000 en zou
  -- zijn onderwaardering anders verdubbeld verzilveren (dubbel_of_niets) of
  -- zijn correctie omlaag gratis wegschermen (schild). wissel_van_kant raakt de
  -- rating niet en heeft die drempel dus niet nodig.
  min_games constant int := 10;
  m record;
begin
  select id, group_id, status, played_at, team_a_id, team_b_id, format
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;
  if m.group_id is null or m.group_id is distinct from new.group_id then
    raise exception 'een joker kan alleen op groepsmatches';
  end if;
  if m.status <> 'scheduled' then
    raise exception 'deze match is al begonnen of afgerond';
  end if;
  -- Zonder starttijd is er geen maand om op af te rekenen, en dus geen tegoed.
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
    raise exception 'alleen spelers uit deze match kunnen een joker spelen';
  end if;
  if new.joker = 'wissel_van_kant' and m.format <> '2v2' then
    raise exception 'van kant wisselen kan alleen in het dubbelspel';
  end if;
  if new.joker in ('schild', 'dubbel_of_niets')
     and coalesce(
           (select games from public.player_ratings where player_id = new.player_id),
           0
         ) < min_games then
    raise exception
      'je rating is nog niet ingelopen: deze joker kan vanaf % gespeelde matches',
      min_games;
  end if;
  -- Anti-stapelen. dubbel_of_niets naast een lef-tip zou ×4 opleveren, en een
  -- schild naast een lef-tip zou die lef-tip geruisloos verdampen (factor 0
  -- wint van alles). Allebei geweigerd: één risicokeuze per match. De speler
  -- trekt zijn lef-tip eerst in, of laat het bij de lef-tip.
  -- wissel_van_kant raakt de rating niet en mag er wél naast.
  if new.joker in ('schild', 'dubbel_of_niets')
     and exists (
       select 1 from public.match_stakes s
       where s.match_id = new.match_id and s.player_id = new.player_id
     ) then
    raise exception 'je lef staat al op deze match: trek die eerst in';
  end if;

  new.period_month := date_trunc('month', m.played_at at time zone tz)::date;
  return new;
end;
$$;

create trigger match_jokers_guard
  before insert or update on public.match_jokers
  for each row execute function public.match_jokers_guard();

-- Een joker intrekken kan alleen zolang de match niet gestart of afgerond is;
-- daarna is de kaart verspeeld. Cascade-deletes (match of groep verwijderd)
-- lopen via de RI-triggers op trigger-diepte > 1 en mogen altijd door — zelfde
-- patroon als match_stakes_delete_guard.
create or replace function public.match_jokers_delete_guard()
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
    raise exception 'je joker staat vast: de match is al begonnen of afgerond';
  end if;
  return old;
end;
$$;

create trigger match_jokers_delete_guard
  before delete on public.match_jokers
  for each row execute function public.match_jokers_delete_guard();

-- De joker die deze speler op deze match speelde, of null. Aparte functie omdat
-- de Elo-kern hem twee keer nodig heeft: één keer voor de factor en één keer om
-- hem in rating_history te loggen.
create or replace function public._player_joker(p_player uuid, p_match uuid)
returns public.joker_type
language sql
security definer
set search_path = ''
stable
as $$
  select j.joker
    from public.match_jokers j
    where j.match_id = p_match and j.player_id = p_player;
$$;

revoke execute on function public._player_joker(uuid, uuid) from public;

-- De multiplier waarmee de Elo-kern de mutatie van één speler vermenigvuldigt:
-- de lef-tip (#804) en de joker (#1003) in één getal.
--
--   schild           → 0   Deze match telt niet voor deze speler. Ook bij
--                          gelijkspel: "telt niet" is onvoorwaardelijk, terwijl
--                          een verdubbeling bij gelijkspel juist géén betekenis
--                          heeft (zie hieronder).
--   dubbel_of_niets  → 2   Alleen als er een winnaar is, exact zoals de
--                          lef-tip: K · (0,5 − E) is voor een underdog positief
--                          en mag geen beloning voor een mislukte gok worden.
--   anders           → de lef-tip-factor (1 of 2).
--
-- greatest() en geen product: de guard verbiedt de combinatie al, maar een rij
-- die er buiten de guard om toch komt (migratie, superuser) mag hooguit ×2
-- opleveren en nooit ×4. Uitkomst is een pure functie van opgeslagen data, dus
-- recompute_ratings() geeft exact hetzelfde resultaat als het incrementele pad.
create or replace function public._effect_factor(
  p_player uuid,
  p_match uuid,
  p_has_winner boolean,
  p_joker public.joker_type
)
returns numeric
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when p_joker = 'schild' then 0.0
    else greatest(
      public._stake_factor(p_player, p_match, p_has_winner),
      case when p_joker = 'dubbel_of_niets' and p_has_winner then 2.0 else 1.0 end
    )
  end;
$$;

revoke execute on function public._effect_factor(uuid, uuid, boolean, public.joker_type) from public;
