-- Pechvogel-meter (#1005): wie drie keer op rij nípt verliest, krijgt bij de
-- derde nederlaag een demper op zijn ratingverlies. Daarna staat de meter weer
-- op nul.
--
-- BEWUST GEEN pechvogel_meters-tabel, om exact dezelfde reden als bij de bounty
-- (31_bounty.sql): recompute_ratings() gooit alle ratings weg en speelt de
-- volledige matchhistorie opnieuw af bij elke correctie, verwijdering of
-- herordening. Muteerbare state naast die replay drift gegarandeerd. De stand
-- van de meter wordt daarom élke keer opnieuw uit matches geteld, met dezelfde
-- totale orde als de replay — incrementeel pad en volledige recompute geven zo
-- gegarandeerd hetzelfde resultaat.
--
-- De "eenmalige" uitbetaling zit in de modulo-regel: de demper valt zodra de
-- reeks een veelvoud van PECHMETER_DOEL is (3, 6, 9, …). Een teller die na
-- uitbetaling "gereset" zou moeten worden is precies de state die hierboven
-- verboden is; modulo doet hetzelfde zonder iets te onthouden.
--
-- Let op: dit is bewust NIET zero-sum. De verliezer betaalt minder, de winnaars
-- krijgen niets minder — er komt dus Elo bij. Zelfde afweging als de lef-tip
-- (#804, zie 30_match_stakes.sql), en de reden dat de demper hard begrensd is
-- op TROOST_MAX: klein genoeg om de inflatie verwaarloosbaar te houden, groot
-- genoeg om te voelen naast een K-factor van 24.

-- Was dit een nípte uitslag? Beide scores ingevuld, een winnaar aanwezig en
-- hooguit NIPT_MARGE (2) punten verschil. Dezelfde eenheid als de rest van de
-- app: score_a/score_b zijn de autoritaire aggregaat (zie tables/05_matches.sql),
-- niet de per-set-uitslag. set_scores wordt in de praktijk nooit gevuld — de
-- issue noemt "tiebreak" als voorbeeld, maar daar valt geen betrouwbare regel
-- op te bouwen; 1 à 2 punten verschil dekt de tiebreak sowieso.
create or replace function public._is_nipt(p_a smallint, p_b smallint)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_a is not null
     and p_b is not null
     and p_a <> p_b
     and abs(p_a - p_b) <= 2;
$$;

revoke execute on function public._is_nipt(smallint, smallint) from public;

-- Aantal nípte nederlagen op rij van een speler vlak vóór een bepaald punt in
-- de historie. Een zege, een gelijkspel, een afdroging (3+ verschil) of een
-- match zonder score breekt de reeks — alleen een nípt verlies telt door.
--
-- Spiegel van bounty_streak (31_bounty.sql): het snijpunt is de totale orde van
-- recompute_ratings (coalesce(played_at, created_at), created_at, id), zodat de
-- reeks tijdens een replay exact de matches ziet die op dat moment al verwerkt
-- zijn. De defaults ('infinity') geven de reeks tót nu — dat is wat de client
-- op het profiel toont.
create or replace function public.pech_streak(
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
      public._is_nipt(mt.score_a, mt.score_b) as nipt,
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
  -- De reeks loopt tot de eerste match die géén nipte nederlaag is,
  -- terugtellend vanaf de recentste match; is die er niet, dan is alles er een.
  select coalesce(
    (
      select min(rn)::int - 1
      from mijn
      where not (
        nipt
        and winner_team_id is not null
        and winner_team_id is distinct from mijn_team
      )
    ),
    (select count(*)::int from mijn)
  );
$$;

grant execute on function public.pech_streak(uuid, timestamptz, timestamptz, uuid)
  to authenticated, anon;

-- De troostdemper van één speler op één match: een positief getal dat bij zijn
-- (negatieve) mutatie opgeteld wordt, of 0. Wordt uitsluitend door de Elo-kern
-- aangeroepen (09_ratings.sql), met de al door lef-tip en bounty bewerkte delta
-- — de demper hangt aan wat je écht verliest, niet aan de kale Elo-mutatie.
--
-- p_delta is de mutatie zoals die zónder troost geboekt zou worden. De demper
-- is de helft daarvan, afgekapt op TROOST_MAX, en nooit groter dan het verlies
-- zelf: een gedempte nederlaag mag nooit in winst omslaan.
create or replace function public._troost_delta(
  p_match uuid,
  p_player uuid,
  p_delta int
)
returns int
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  -- Aantal nipte nederlagen op rij waarbij de meter vol is. Spiegel van
  -- PECHMETER_DOEL in features/rating/pechvogel.ts.
  doel constant int := 3;
  -- Harde bovengrens van de demper, afgestemd op de K-factor (24): een normale
  -- partij verschuift zo'n 10 à 14 Elo, dus 4 is voelbaar zonder de uitslag te
  -- overstemmen. Zelfde redenering als de vaste bounty-pool van 8 (#823).
  troost_max constant int := 4;
  -- Startmoment van de feature. De demper is afgeleid, dus zónder deze grens
  -- zou de eerstvolgende recompute met terugwerkende kracht de hele historie
  -- herschrijven — elke oude pechreeks zou alsnog uitbetaald worden. Wil je dat
  -- later wél, zet deze constante op '-infinity' en draai recompute_ratings();
  -- alles blijft deterministisch. Zelfde patroon als _bounty_deltas (#805).
  vanaf constant timestamptz := '2026-08-04 00:00:00+02';
  m record;
  v_mijn_team uuid;
  v_streak int;
  v_troost int;
begin
  -- Alleen een verlies valt te troosten: bij een winst of een gelijkspel valt
  -- er niets te dempen (en zou een demper de mutatie zelfs opblazen).
  if p_delta >= 0 then
    return 0;
  end if;

  select mt.id, mt.team_a_id, mt.team_b_id, mt.winner_team_id,
         mt.score_a, mt.score_b,
         coalesce(mt.played_at, mt.created_at) as ts, mt.created_at
    into m
    from public.matches mt
    where mt.id = p_match;

  if m.id is null or m.winner_team_id is null or m.ts < vanaf then
    return 0;
  end if;

  -- Was déze nederlaag zelf nipt? Zo niet, dan is de meter net leeggelopen en
  -- valt er niets uit te keren.
  if not public._is_nipt(m.score_a, m.score_b) then
    return 0;
  end if;

  -- Speelt iemand (schema-technisch mogelijk) in beide teams, dan telt team A
  -- en verliest hij dus hooguit half; de demper blijft dan achterwege zodra
  -- team A won. Staat hij in geen van beide teams, dan valt er niets te dempen.
  select case
           when ta.player1_id = p_player or ta.player2_id = p_player then m.team_a_id
           when tb.player1_id = p_player or tb.player2_id = p_player then m.team_b_id
         end
    into v_mijn_team
    from public.teams ta, public.teams tb
    where ta.id = m.team_a_id and tb.id = m.team_b_id;

  if v_mijn_team is null or m.winner_team_id = v_mijn_team then
    return 0;
  end if;

  -- Deze match meegeteld: is de meter nu (weer) vol?
  v_streak := public.pech_streak(p_player, m.ts, m.created_at, m.id) + 1;
  if v_streak % doel <> 0 then
    return 0;
  end if;

  -- Halve klap, afgekapt, en nooit meer dan het verlies zelf.
  v_troost := least(troost_max, ((-p_delta) + 1) / 2);
  return least(v_troost, -p_delta);
end;
$$;

revoke execute on function public._troost_delta(uuid, uuid, int) from public;