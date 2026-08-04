-- Rudy's VAR (#1025): guards en afhandeling. De tabellen en de motivatie voor
-- het beroep op de eindstand staan in tables/25_point_appeals.sql.
--
-- De guard is de enige echte poort: RLS regelt wie een rij mag zien en
-- aanmaken, de guard regelt of dat beroep überhaupt mag bestaan. De afhandeling
-- loopt via resolve_point_appeal (SECURITY DEFINER) — een gewone gebruiker kan
-- de score niet aanraken (#432), maar een toegekend beroep wel.

-- Speelt deze speler mee in deze match? Losse helper omdat zowel de guards als
-- de policies hem nodig hebben.
create or replace function public._is_match_deelnemer(p_match uuid, p_player uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match
      and p_player is not null
      and (
        public.is_team_member(m.team_a_id, p_player)
        or public.is_team_member(m.team_b_id, p_player)
      )
  );
$$;

revoke execute on function public._is_match_deelnemer(uuid, uuid) from public;
grant execute on function public._is_match_deelnemer(uuid, uuid) to authenticated;

-- Wie mag een beroep zien: de vier op de baan, plus de leden van de groep waar
-- de match in hangt. Een beroep is publiek binnen de groep — dat is het punt
-- van de ceremonie — maar bij een match zonder groep blijft het bij de spelers.
create or replace function public._mag_beroep_zien(p_match uuid, p_uid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select p_uid is not null and exists (
    select 1
    from public.matches m
    where m.id = p_match
      and (
        public.is_team_member(m.team_a_id, p_uid)
        or public.is_team_member(m.team_b_id, p_uid)
        or (m.group_id is not null and public.is_group_member(m.group_id, p_uid))
      )
  );
$$;

revoke execute on function public._mag_beroep_zien(uuid, uuid) from public;
grant execute on function public._mag_beroep_zien(uuid, uuid) to authenticated;

-- De stemgerechtigden: de andere deelnemers, tegenpartij inbegrepen. Die is per
-- definitie belanghebbend, en dat maakt het juist leuk — bij 2v2 stemmen er zo
-- drie, dus een gelijkspel kan niet.
--
-- Gasten (profiles.is_guest) vallen weg: die loggen nooit in, dus hun stem zou
-- nooit komen en het beroep zou tot het einde van het venster blijven hangen.
create or replace function public._beroep_stemgerechtigden(p_match uuid, p_claimant uuid)
returns uuid[]
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(array_agg(distinct s.speler), '{}'::uuid[])
  from (
    select unnest(array[ta.player1_id, ta.player2_id, tb.player1_id, tb.player2_id]) as speler
    from public.matches m
    join public.teams ta on ta.id = m.team_a_id
    join public.teams tb on tb.id = m.team_b_id
    where m.id = p_match
  ) s
  join public.profiles p on p.id = s.speler
  where s.speler is distinct from p_claimant
    and not p.is_guest;
$$;

revoke execute on function public._beroep_stemgerechtigden(uuid, uuid) from public;
grant execute on function public._beroep_stemgerechtigden(uuid, uuid) to authenticated;

-- Guard op het beroep zelf. Zet ook alles wat de client niet mag bepalen: de
-- snapshot van de stand, de speeldag (het tegoed) en het stemvenster.
create or replace function public.point_appeals_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Clubtijd, dezelfde constante als de Edge Functions en dayInZone.
  tz constant text := 'Europe/Brussels';
  -- Tot 24 u na de match kan er betwist worden; daarna is de historie dicht.
  venster constant interval := interval '24 hours';
  -- En de stemming loopt 12 u vanaf het indienen.
  stemvenster constant interval := interval '12 hours';
  m record;
  v_kant text;
  v_sets jsonb;
  v_tegen int; -- games van de tegenpartij in de betwiste set
begin
  select id, status, played_at, team_a_id, team_b_id, score_a, score_b, set_scores
    into m
    from public.matches
    where id = new.match_id;

  if m.id is null then
    raise exception 'match bestaat niet';
  end if;
  if m.status <> 'completed' then
    raise exception 'je kunt alleen een afgeronde match betwisten';
  end if;
  -- Zonder speelmoment is er geen venster en geen speeldag om het tegoed op af
  -- te rekenen.
  if m.played_at is null then
    raise exception 'deze match heeft geen speelmoment';
  end if;
  if now() > m.played_at + venster then
    raise exception 'het VAR-venster van 24 uur is gesloten';
  end if;
  if not public._is_match_deelnemer(m.id, new.claimant_id) then
    raise exception 'alleen spelers uit deze match kunnen betwisten';
  end if;
  if m.score_a is null or m.score_b is null then
    raise exception 'deze match heeft geen ingevulde uitslag';
  end if;

  v_kant := case
    when public.is_team_member(m.team_a_id, new.claimant_id) then 'a'
    else 'b'
  end;

  -- Je kunt geen punt afpakken van een team dat er geen heeft.
  if (v_kant = 'a' and m.score_b <= 0) or (v_kant = 'b' and m.score_a <= 0) then
    raise exception 'de tegenpartij heeft geen punt om af te staan';
  end if;

  -- Set-stand: staat die er, dan moet het beroep zeggen wélke set het betreft,
  -- zodat kopscore en set-stand samen bewegen. Staat die er niet, dan hoort
  -- set_number leeg te blijven.
  v_sets := m.set_scores;
  if jsonb_typeof(v_sets) = 'array' and jsonb_array_length(v_sets) > 0 then
    if new.set_number is null then
      raise exception 'geef aan in welke set het punt viel';
    end if;
    if new.set_number > jsonb_array_length(v_sets) then
      raise exception 'die set staat niet in de uitslag';
    end if;
    v_tegen := case
      when v_kant = 'a' then (v_sets -> (new.set_number - 1) ->> 1)::int
      else (v_sets -> (new.set_number - 1) ->> 0)::int
    end;
    if v_tegen is null or v_tegen <= 0 then
      raise exception 'de tegenpartij heeft in die set geen punt om af te staan';
    end if;
  elsif new.set_number is not null then
    raise exception 'deze match heeft geen set-stand';
  end if;

  -- Er moet iemand zijn om te overtuigen. Bij een match die verder uit gasten
  -- bestaat is er niemand die kan stemmen en zou het beroep tot het einde van
  -- het venster blijven staan om dan alsnog afgewezen te worden.
  if coalesce(
       array_length(public._beroep_stemgerechtigden(m.id, new.claimant_id), 1),
       0
     ) = 0 then
    raise exception 'er is niemand die over dit beroep kan stemmen';
  end if;

  new.play_date := (m.played_at at time zone tz)::date;

  -- Het tegoed. De partiële unieke index point_appeals_tegoed_uidx is wat het
  -- echt afdwingt (twee beroepen op dezelfde avond kunnen tegelijk openstaan en
  -- pas bij de afhandeling botsen); deze check maakt er alleen een leesbare
  -- melding van op het moment dat het al duidelijk is.
  if exists (
    select 1 from public.point_appeals a
    where a.claimant_id = new.claimant_id
      and a.play_date = new.play_date
      and a.status = 'toegekend'
      and a.id is distinct from new.id
  ) then
    raise exception 'je VAR-tegoed van deze speeldag is al gebruikt';
  end if;

  new.snapshot_a := m.score_a;
  new.snapshot_b := m.score_b;
  new.status := 'open';
  new.resolved_at := null;
  new.votes_close_at := now() + stemvenster;
  return new;
end;
$$;

create trigger point_appeals_guard
  before insert on public.point_appeals
  for each row execute function public.point_appeals_guard();

-- Guard op de stemmen: alleen de stemgerechtigden, alleen zolang het beroep
-- openstaat en het venster loopt. Wijzigen of intrekken kan niet — er is
-- bewust geen update- of delete-policy: wie stemt, staat erachter.
create or replace function public.point_appeal_votes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
begin
  select id, match_id, claimant_id, status, votes_close_at
    into a
    from public.point_appeals
    where id = new.appeal_id;

  if a.id is null then
    raise exception 'dit beroep bestaat niet';
  end if;
  if a.status <> 'open' then
    raise exception 'over dit beroep is al uitspraak gedaan';
  end if;
  if now() > a.votes_close_at then
    raise exception 'de stemming is gesloten';
  end if;
  if new.voter_id = a.claimant_id then
    raise exception 'je stemt niet over je eigen beroep';
  end if;
  if not (new.voter_id = any (public._beroep_stemgerechtigden(a.match_id, a.claimant_id))) then
    raise exception 'alleen de andere spelers uit deze match kunnen stemmen';
  end if;
  return new;
end;
$$;

create trigger point_appeal_votes_guard
  before insert on public.point_appeal_votes
  for each row execute function public.point_appeal_votes_guard();

-- De uitspraak. Telt de stemmen en, bij een toekenning, verschuift het punt en
-- alles wat eraan hangt — in één transactie.
--
-- Uitkomst:
--   * meerderheid van de stemgerechtigden vóór  -> 'toegekend'
--   * gelijkspel of meerderheid tegen           -> 'afgewezen'
--   * venster verlopen zonder meerderheid       -> 'afgewezen' (p_venster_verlopen)
--   * stand intussen gewijzigd                  -> 'verlopen'
--   * groep akkoord maar tegoed al op           -> 'tegoed-op'
--   * nog niets beslist                         -> 'open' (no-op)
--
-- Wordt na élke stem aangeroepen, zodat de uitspraak valt zodra ze vaststaat en
-- niemand op het venster hoeft te wachten.
create or replace function public.resolve_point_appeal(
  p_appeal_id uuid,
  p_venster_verlopen boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  m record;
  v_kiezers uuid[];
  v_n int;
  v_voor int;
  v_tegen int;
  v_kant text;
  v_a smallint;
  v_b smallint;
  v_sets jsonb;
  v_sa int;
  v_sb int;
  v_winner uuid;
begin
  select * into a from public.point_appeals where id = p_appeal_id for update;
  if not found then
    return 'onbekend';
  end if;
  if a.status <> 'open' then
    return a.status;
  end if;

  v_kiezers := public._beroep_stemgerechtigden(a.match_id, a.claimant_id);
  v_n := coalesce(array_length(v_kiezers, 1), 0);
  select count(*) filter (where v.akkoord),
         count(*) filter (where not v.akkoord)
    into v_voor, v_tegen
    from public.point_appeal_votes v
    where v.appeal_id = a.id
      and v.voter_id = any (v_kiezers);

  -- Meerderheid vóór is een strikte meerderheid; bij gelijkspel wint de
  -- bestaande uitslag. De tweede tak vangt ook het geval waarin de rest nog
  -- niet gestemd heeft maar de uitkomst al vastligt.
  if v_voor * 2 <= v_n then
    if v_tegen * 2 >= v_n or p_venster_verlopen then
      update public.point_appeals
         set status = 'afgewezen', resolved_at = now()
       where id = a.id;
      return 'afgewezen';
    end if;
    return 'open';
  end if;

  select id, team_a_id, team_b_id, score_a, score_b, set_scores
    into m
    from public.matches
    where id = a.match_id
    for update;

  -- Randgeval uit de issue: is de uitslag intussen langs een andere weg
  -- gewijzigd (#978, #681), dan slaat dit beroep op een stand die niet meer
  -- bestaat. Het vervalt in plaats van een tweede correctie te stapelen.
  if not found
     or m.score_a is distinct from a.snapshot_a
     or m.score_b is distinct from a.snapshot_b then
    update public.point_appeals
       set status = 'verlopen', resolved_at = now()
     where id = a.id;
    return 'verlopen';
  end if;

  v_kant := case
    when public.is_team_member(m.team_a_id, a.claimant_id) then 'a'
    else 'b'
  end;
  v_a := m.score_a + case when v_kant = 'a' then 1 else -1 end;
  v_b := m.score_b + case when v_kant = 'b' then 1 else -1 end;
  if v_a < 0 or v_b < 0 then
    update public.point_appeals
       set status = 'verlopen', resolved_at = now()
     where id = a.id;
    return 'verlopen';
  end if;

  v_sets := m.set_scores;
  if a.set_number is not null
     and jsonb_typeof(v_sets) = 'array'
     and jsonb_array_length(v_sets) >= a.set_number then
    v_sa := (v_sets -> (a.set_number - 1) ->> 0)::int
            + case when v_kant = 'a' then 1 else -1 end;
    v_sb := (v_sets -> (a.set_number - 1) ->> 1)::int
            + case when v_kant = 'b' then 1 else -1 end;
    if v_sa < 0 or v_sb < 0 then
      update public.point_appeals
         set status = 'verlopen', resolved_at = now()
       where id = a.id;
      return 'verlopen';
    end if;
    v_sets := jsonb_set(v_sets, array[(a.set_number - 1)::text, '0'], to_jsonb(v_sa));
    v_sets := jsonb_set(v_sets, array[(a.set_number - 1)::text, '1'], to_jsonb(v_sb));
  end if;

  -- De winnaar volgt uit de kopscore, net zoals bij het invullen van de uitslag
  -- (PlannedMatchCard/NewMatchSheet): gelijk = gelijkspel.
  v_winner := case
    when v_a > v_b then m.team_a_id
    when v_b > v_a then m.team_b_id
    else null
  end;

  -- Eerst het beroep zelf, want dat is wat op het tegoed botst. Won je vandaag
  -- al een beroep, dan geeft point_appeals_tegoed_uidx hier een unique_violation
  -- en blijft de uitslag ongemoeid: de groep gaf je gelijk, maar je VAR was op.
  begin
    update public.point_appeals
       set status = 'toegekend', resolved_at = now()
     where id = a.id;
  exception when unique_violation then
    update public.point_appeals
       set status = 'tegoed-op', resolved_at = now()
     where id = a.id;
    return 'tegoed-op';
  end;

  -- En dan de correctie. Alles wat eraan hangt beweegt mee via de bestaande
  -- statement-triggers op public.matches: de Elo-keten (recompute_ratings),
  -- de pias, de Zwarte Piet, de bounty en de rangstand. De toto-tips lopen mee
  -- via matches_grade_predictions, die op winner_team_id in de SET-lijst vuurt
  -- — een expliciete _grade_completed_match is hier dus niet nodig, anders dan
  -- in replace_match_player (daar verhuizen de tips ná de match-update).
  --
  -- Let op: de Elo-kern kijkt alleen naar winner_team_id, niet naar de marge.
  -- Een toekenning die de winnaar niet omdraait (16-10 wordt 15-11) laat het
  -- klassement dus bewust ongemoeid.
  update public.matches
     set score_a = v_a,
         score_b = v_b,
         set_scores = v_sets,
         winner_team_id = v_winner
   where id = m.id;

  return 'toegekend';
end;
$$;

-- Expliciet ook van anon en authenticated afnemen, niet alleen van PUBLIC:
-- Supabase zet `alter default privileges ... grant execute on functions to
-- anon, authenticated, service_role`, dus een nieuwe functie is standaard
-- oproepbaar door elke ingelogde gebruiker. Zonder deze revoke zou iedereen
-- resolve_point_appeal(…, true) kunnen aanroepen en zo een openstaand beroep
-- vóór het einde van het stemvenster laten afwijzen.
revoke execute on function public.resolve_point_appeal(uuid, boolean)
  from public, anon, authenticated;

-- Na elke stem meteen kijken of de uitspraak al vaststaat.
create or replace function public.point_appeal_votes_resolve()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.resolve_point_appeal(new.appeal_id);
  return null;
end;
$$;

create trigger point_appeal_votes_resolve
  after insert on public.point_appeal_votes
  for each row execute function public.point_appeal_votes_resolve();

-- Verlopen beroepen sluiten. Bedoeld voor de cron-gestuurde Edge Function
-- (zoals poll-deadline de polls sluit); geeft terug hoeveel er afgehandeld zijn.
create or replace function public.expire_point_appeals()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_aantal int := 0;
begin
  for v_id in
    select id from public.point_appeals
    where status = 'open' and votes_close_at <= now()
    order by votes_close_at
  loop
    perform public.resolve_point_appeal(v_id, true);
    v_aantal := v_aantal + 1;
  end loop;
  return v_aantal;
end;
$$;

-- Zelfde reden als hierboven: alleen de cron (service_role) sluit beroepen.
revoke execute on function public.expire_point_appeals()
  from public, anon, authenticated;
grant execute on function public.expire_point_appeals() to service_role;
