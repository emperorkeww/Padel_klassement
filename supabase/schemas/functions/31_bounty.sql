-- Bounty op de kop van de leider (#805): wie bovenaan staat draagt een prijs op
-- z'n hoofd. Verslaat een team hem, dan verhuist de vaste pool als extra
-- Elo naar de winnaars. Twee soorten dragers, allebei uit de rating afgeleid:
--   * Dictator — rating ≥ 1600 (de El Padelissimo-drempel uit tiers.ts). Geldt
--     in élke match, ook buiten een groep. Bewust de tier-drempel en niet de
--     zittende troon uit dictator_termijnen (#545): die replay-tabel wordt ná
--     de rating-replay herbouwd en is tijdens _apply_match_rating dus stale —
--     eruit lezen zou circulair zijn. De issue spreekt zelf van "Dictator(s)
--     (1600+ Elo)", meervoud, dus dit dekt de bedoeling.
--   * Big Daddy — de hoogst gerate niet-gast van de groep van de match. Geen
--     groep, geen Big Daddy-bounty (de kroon is per groep, de troon globaal).
--
-- BEWUST GEEN bounty_pools-tabel, hoe erg de issue er ook naar hint.
-- recompute_ratings() gooit alle ratings weg en speelt de volledige
-- matchhistorie opnieuw af bij elke correctie, verwijdering of herordening.
-- Muteerbare state naast die replay gaat gegarandeerd driften. Alles hier is
-- daarom een pure functie van opgeslagen data op het replay-moment —
-- player_ratings staat tijdens de replay exact op de vóór-match-stand, en de
-- streak wordt uit matches geteld met dezelfde totale orde als de replay.
-- Zelfde reden als _stake_factor bij de lef-tip (#804): incrementeel pad en
-- volledige recompute geven zo gegarandeerd hetzelfde resultaat.
--
-- Boekhouding: strikt zero-sum. De drager betaalt zijn eigen pool, de winnaars
-- delen precies dat bedrag. Een bonus-only variant zou per claim Elo bijmaken,
-- en de dictator-drempel (1600) is absoluut — inflatie maakt de troon
-- structureel goedkoper. Zie ook de motivatie in tables/21_match_stakes.sql.

-- DE BOUNTY STAAT UIT (#1168). De pool is 0, dus er verhuist geen Elo meer en
-- alles hieronder rekent nog wel, maar levert nul op. Bewust hier uitgezet en
-- niet ergens verderop: dit is het enige punt waar de waarde vandaan komt, dus
-- zowel de uitkering (_bounty_deltas) als de aankondiging (active_bounties) als
-- de client (rating/bounty.ts, die deze waarde spiegelt) volgen vanzelf.
--
-- Weer aanzetten = de waarde terugzetten en `select public.recompute_ratings()`
-- draaien; de historie rekent dan opnieuw mét bounty, want er staat nergens
-- muteerbare state naast de replay (zie de kop hierboven). Vergeet daarbij de
-- afgeleide replays niet — recompute_ratings() raakt public.matches niet en
-- vuurt hun triggers dus niet af; de volgorde staat in de migratie
-- 20260808100000_1168_bounty_uit.sql.
--
-- Wat de waarde wás: 8, ongeacht de zegereeks van de drager (#823). Afgestemd
-- op de K-factor van de Elo-kern (24, zie 09_ratings.sql): een normale partij
-- verschuift in de praktijk zo'n 10 à 14 Elo, dus bij de oude pool van 16 woog
-- de kop van de leider zwaarder dan de uitslag zelf. Een derde van K liet de
-- bounty voelbaar zijn zonder de match te overstemmen, en 8 is even — in een
-- dubbel splitste hij netjes 4/4, zonder de oneven-restregel hieronder.
--
-- De parameter blijft bestaan voor call-compatibiliteit met active_bounties en
-- _bounty_deltas. Immutable en publiek uitvoerbaar.
create or replace function public.bounty_value(p_streak int)
returns int
language sql
immutable
set search_path = ''
as $$
  select 0;
$$;

-- Actieve zegereeks van een speler vlak vóór een bepaald punt in de historie.
-- Telt echte uitslagen (winner_team_id), niet de delta > 0-benadering uit
-- onFire.ts: die kan er bij een gelijkspel naast zitten en hier hangt Elo aan
-- vast. Een gelijkspel of verlies breekt de reeks.
--
-- Het snijpunt is de totale orde van recompute_ratings
-- (coalesce(played_at, created_at), created_at, id), zodat de reeks tijdens een
-- replay exact de matches ziet die op dat moment al verwerkt zijn. De defaults
-- ('infinity') geven de reeks tót nu — dat is wat active_bounties en de UI
-- tonen.
create or replace function public.bounty_streak(
  p_player uuid,
  p_ts timestamptz default 'infinity',
  p_created timestamptz default 'infinity',
  p_match uuid default '00000000-0000-0000-0000-000000000000'
)
returns int
language sql
security definer
set search_path = ''
stable
as $$
  with mijn as (
    select
      mt.winner_team_id,
      case
        when ta.player1_id = p_player or ta.player2_id = p_player
        then mt.team_a_id else mt.team_b_id
      end as mijn_team,
      row_number() over (
        order by coalesce(mt.played_at, mt.created_at) desc, mt.created_at desc, mt.id desc
      ) as rn
    from public.matches mt
    join public.teams ta on ta.id = mt.team_a_id
    join public.teams tb on tb.id = mt.team_b_id
    where mt.status = 'completed'
      and (coalesce(mt.played_at, mt.created_at), mt.created_at, mt.id)
          < (p_ts, p_created, p_match)
      and (ta.player1_id = p_player or ta.player2_id = p_player
           or tb.player1_id = p_player or tb.player2_id = p_player)
  )
  -- De reeks loopt tot de eerste niet-zege, terugtellend vanaf de recentste
  -- match; is er geen niet-zege, dan is alles een zege.
  select coalesce(
    (select min(rn)::int - 1 from mijn where winner_team_id is distinct from mijn_team),
    (select count(*)::int from mijn)
  );
$$;

-- De hoogst gerate niet-gast van een groep: de Big Daddy. Tie-break net als in
-- de troon-replay (#545): langste lid eerst, dan id — deterministisch, zodat
-- een gelijke stand niet per replay een andere drager oplevert.
create or replace function public._group_leader(p_group uuid, p_min_games int)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select gm.player_id
  from public.group_members gm
  join public.profiles p on p.id = gm.player_id
  join public.player_ratings r on r.player_id = gm.player_id
  where gm.group_id = p_group
    and not p.is_guest
    and r.games >= p_min_games
  order by r.rating desc, p.created_at asc, p.id asc
  limit 1;
$$;

revoke execute on function public._group_leader(uuid, int) from public;

-- Per-speler Elo-verschuiving door de bounty op één match: negatief voor de
-- verslagen drager(s), positief voor de winnaars. Levert alleen rijen op voor
-- spelers die daadwerkelijk betalen of ontvangen; de rest staat er niet in.
--
-- Wordt uitsluitend door de Elo-kern aangeroepen (09_ratings.sql), vóór de
-- eerste _apply_rating — daarna is player_ratings al bijgewerkt en zou de
-- drager-check de ná-match-stand zien.
create or replace function public._bounty_deltas(p_match uuid)
returns table (player_id uuid, bounty int)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  -- El Padelissimo-instap (#527, tiers.ts) — dezelfde drempel als de troon.
  drempel constant int := 1600;
  -- Onder dit aantal matches is de rating te dun om er een kroon aan te hangen
  -- (THIN_GAMES, groupRating.ts). Zonder deze rem draagt een nieuwkomer die na
  -- twee toevalstreffers bovenaan piekt meteen de volle pool op z'n hoofd.
  min_games constant int := 3;
  -- Startmoment van de feature. De bounty is afgeleid, dus zónder deze grens
  -- zou de eerstvolgende recompute met terugwerkende kracht de hele historie
  -- herschrijven — de zittende #1 zou dan alsnog elke oude nederlaag betalen.
  -- Wil je dat later wél, zet deze constante op '-infinity' en draai
  -- recompute_ratings(); alles blijft deterministisch.
  vanaf constant timestamptz := '2026-07-29 00:00:00+02';
  m record;
  d record;
  v_win_team uuid;
  v_los_team uuid;
  w1 uuid; w2 uuid;              -- winnaars
  l1 uuid; l2 uuid;              -- verliezers
  v_pot int := 0;                -- totale pool van de verslagen dragers
begin
  select mt.id, mt.team_a_id, mt.team_b_id, mt.winner_team_id, mt.group_id,
         coalesce(mt.played_at, mt.created_at) as ts, mt.created_at
    into m
    from public.matches mt
    where mt.id = p_match;

  -- Geen match, geen winnaar (een gelijkspel keert niets uit) of van vóór de
  -- invoering: niets te verdelen.
  if m.id is null or m.winner_team_id is null or m.ts < vanaf then
    return;
  end if;

  v_win_team := m.winner_team_id;
  v_los_team := case when v_win_team = m.team_a_id then m.team_b_id else m.team_a_id end;

  select t.player1_id, t.player2_id into w1, w2 from public.teams t where t.id = v_win_team;
  select t.player1_id, t.player2_id into l1, l2 from public.teams t where t.id = v_los_team;

  if w1 is null or l1 is null then
    return; -- team verwijderd; zelfde afhandeling als _apply_match_rating
  end if;

  -- Verslagen dragers: hun pool gaat de pot in en komt van hun eigen rating af.
  for d in
    select v.speler,
           public.bounty_value(
             public.bounty_streak(v.speler, m.ts, m.created_at, m.id)
           ) as pool
    from (select l1 as speler union select l2) v
    join public.profiles p on p.id = v.speler
    join public.player_ratings r on r.player_id = v.speler
    where not p.is_guest
      and r.games >= min_games
      -- Speelt iemand (schema-technisch mogelijk) in beide teams, dan wint en
      -- verliest hij tegelijk; er valt dan niets te claimen.
      and v.speler is distinct from w1
      and v.speler is distinct from w2
      and (
        r.rating >= drempel
        or (m.group_id is not null and v.speler = public._group_leader(m.group_id, min_games))
      )
  loop
    v_pot := v_pot + d.pool;
    player_id := d.speler;
    bounty := -d.pool;
    return next;
  end loop;

  if v_pot = 0 then
    return;
  end if;

  -- De winnaars delen de pot exact: bij een oneven bedrag krijgt speler 1 de
  -- extra Elo. Samen tellen alle rijen op tot nul — de bounty maakt geen Elo bij.
  if w2 is null then
    player_id := w1; bounty := v_pot; return next;
  else
    player_id := w1; bounty := v_pot - (v_pot / 2); return next;
    player_id := w2; bounty := v_pot / 2; return next;
  end if;
end;
$$;

revoke execute on function public._bounty_deltas(uuid) from public;
