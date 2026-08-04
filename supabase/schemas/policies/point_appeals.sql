-- Rudy's VAR (#1025): wie ziet en wie schrijft. Dat het beroep überhaupt mag
-- bestaan — afgeronde match, binnen het venster, tegoed niet op, en de
-- serverside kolommen (snapshot, speeldag, stemvenster) — borgt de guard
-- (functions/36_point_appeals.sql).

-- Zichtbaar voor de spelers en, als de match in een groep hangt, voor de hele
-- groep. Een VAR-zaak is publiek binnen de groep: dat is het punt.
create policy "point_appeals_select_zichtbaar" on public.point_appeals
  for select
  using (public._mag_beroep_zien(match_id, (select auth.uid())));

create policy "point_appeals_insert_own" on public.point_appeals
  for insert
  with check (
    claimant_id = (select auth.uid())
    and public._is_match_deelnemer(match_id, (select auth.uid()))
  );

-- Bewust geen update- of delete-policy. Er is geen "toch niet"-knop: wie beroep
-- aantekent staat erachter tot de uitspraak valt. De afhandeling loopt
-- uitsluitend via resolve_point_appeal/expire_point_appeals (SECURITY DEFINER).

-- Kolomprivileges: status, snapshot, play_date, votes_close_at en resolved_at
-- worden serverside gezet en dragen het tegoed, het venster en de uitspraak.
-- RLS kan geen kolommen beschermen, dus de insert-grant is smal — zelfde
-- patroon als match_stakes en match_jokers.
revoke insert, update on public.point_appeals from authenticated;
grant insert (match_id, claimant_id, set_number, reden, toelichting)
  on public.point_appeals to authenticated;

-- Stemmen zijn zichtbaar voor iedereen die het beroep ziet: mét naam, zodat
-- iedereen weet wie wat vond. Je plaatst alleen je eigen stem; of je
-- stemgerechtigd bent, bewaakt de guard.
create policy "point_appeal_votes_select_zichtbaar" on public.point_appeal_votes
  for select
  using (
    exists (
      select 1 from public.point_appeals a
      where a.id = appeal_id
        and public._mag_beroep_zien(a.match_id, (select auth.uid()))
    )
  );

create policy "point_appeal_votes_insert_own" on public.point_appeal_votes
  for insert
  with check (voter_id = (select auth.uid()));

-- Geen update- of delete-policy: een uitgebrachte stem ligt vast.
revoke insert, update on public.point_appeal_votes from authenticated;
grant insert (appeal_id, voter_id, akkoord)
  on public.point_appeal_votes to authenticated;
