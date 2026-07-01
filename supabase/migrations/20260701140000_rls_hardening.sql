-- RLS-hardening n.a.v. de RLS-audit (2026-07-01).
--
-- Context: de app is een SPA die met de anon key rechtstreeks op Postgres praat.
-- RLS-policies + database-constraints zijn de ENIGE beveiligingslaag; ga uit van
-- een aanvaller die willekeurige queries/mutaties via de Supabase API stuurt.
--
-- Alle match- en team-creatie loopt in de app via SECURITY DEFINER RPC's
-- (create_completed_match, generate_americano_round, _ensure_team). Die draaien
-- als owner en omzeilen RLS, dus directe INSERT/UPDATE op die tabellen door
-- clients is niet nodig — en werd juist misbruikt om de friend-restrictie en het
-- klassement te omzeilen. We trekken die directe schrijfpaden hier dicht.
--
-- NB (schema-drift): supabase/schemas/ dekt alleen profiles/teams/matches/
-- match_points. De sociale laag (friendships/groups/group_members, de views en
-- de RPC's) ontbreekt daar. Aanbevolen: die map los reconciliëren zodat een
-- toekomstige `supabase db diff` geen DROP-statements voor die objecten genereert.

------------------------------------------------------------------------
-- K1) matches: verwijder de directe INSERT-policy.
--     `create policy ... for insert with check (auth.uid() = created_by)` eiste
--     enkel created_by = jij, niet dat je deelnemer bent. Daarmee kon een
--     aanvaller willekeurige 'completed' matches tussen vreemde teams fabriceren
--     -> klassementvervalsing. Matches worden voortaan uitsluitend via de RPC's
--     aangemaakt (die deelnemer- én vriend-checks afdwingen). Zonder INSERT-
--     policy weigert RLS elke directe INSERT; de SECURITY DEFINER RPC's blijven
--     werken omdat ze als owner draaien.
------------------------------------------------------------------------
drop policy if exists "Gebruiker kan match aanmaken" on public.matches;

------------------------------------------------------------------------
-- H1/H2) teams: verwijder de directe INSERT- en UPDATE-policies.
--     Teams worden enkel via public._ensure_team() (SECURITY DEFINER) aangemaakt.
--     - INSERT liet je zonder vriend-check een team met een willekeurig
--       slachtoffer vormen.
--     - UPDATE liet een teamlid de ANDERE speler vervangen en zo historische
--       matchstatistiek naar een slachtoffer verschuiven (klassement/reputatie).
------------------------------------------------------------------------
drop policy if exists "Speler kan eigen team aanmaken" on public.teams;
drop policy if exists "Teamlid kan team bijwerken" on public.teams;

------------------------------------------------------------------------
-- K2) friendships: self-accept onmogelijk maken.
--     a) INSERT: alleen een 'pending'-verzoek dat je zelf als verzoeker stuurt.
--        (De oude policy liet status='accepted' toe -> vriendschap zonder
--        toestemming van de ontvanger.)
--     b) UPDATE: de ontvanger mag enkel accepteren/weigeren, en de
--        (requester_id, addressee_id) mogen NIET wijzigen. Anders kon de
--        ontvanger van een verzoek de verzoeker herschrijven naar een
--        willekeurig slachtoffer en 'accepted' zetten (self-accept-variant).
--     Deze poort (are_friends) beveiligt create_completed_match en het
--     toevoegen van groepsleden, dus de bypass hier ondermijnde beide.
------------------------------------------------------------------------
drop policy if exists "Verzoek sturen als verzoeker" on public.friendships;
create policy "Verzoek sturen als verzoeker"
  on public.friendships for insert
  to authenticated
  with check (
    (select auth.uid()) = requester_id
    and status = 'pending'
  );

drop policy if exists "Ontvanger kan verzoek beantwoorden" on public.friendships;
create policy "Ontvanger kan verzoek beantwoorden"
  on public.friendships for update
  to authenticated
  using ((select auth.uid()) = addressee_id)
  with check (
    (select auth.uid()) = addressee_id
    and status in ('accepted', 'declined')
  );

-- Maak het spelerspaar onveranderlijk na aanmaken (dekt beide richtingen van de
-- self-accept-variant; RLS-with-check kan OLD niet vergelijken, vandaar een trigger).
create or replace function public.friendships_freeze_participants()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.requester_id <> old.requester_id
     or new.addressee_id <> old.addressee_id then
    raise exception 'requester_id en addressee_id kunnen niet worden gewijzigd';
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_freeze_participants on public.friendships;
create trigger friendships_freeze_participants
  before update on public.friendships
  for each row execute function public.friendships_freeze_participants();

------------------------------------------------------------------------
-- L1) match_points: won_by_team_id moet één van de twee teams van de match zijn.
--     De insert-policy checkt de match-eigenaar, maar niets koppelde het
--     winnende team aan de match. Een check-constraint kan niet naar een andere
--     tabel verwijzen, dus een BEFORE INSERT-trigger.
------------------------------------------------------------------------
create or replace function public.match_points_validate_team()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  select new.won_by_team_id in (m.team_a_id, m.team_b_id)
    into v_ok
  from public.matches m
  where m.id = new.match_id;

  if not coalesce(v_ok, false) then
    raise exception 'won_by_team_id moet team_a of team_b van de match zijn';
  end if;
  return new;
end;
$$;

drop trigger if exists match_points_validate_team on public.match_points;
create trigger match_points_validate_team
  before insert on public.match_points
  for each row execute function public.match_points_validate_team();