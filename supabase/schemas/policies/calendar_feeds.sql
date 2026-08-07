-- Je agenda-links zijn strikt persoonlijk (#1099): je ziet alleen je eigen
-- rijen. Aanmaken en intrekken lopen via public.rotate_calendar_feed en
-- public.revoke_calendar_feeds (functions/39), dus er is bewust geen insert- of
-- update-policy — dat houdt "wie mag hier iets mee" op één plek.
--
-- Het uitlezen van een feed loopt óók buiten deze policies om: de agenda-app
-- van een gebruiker is niet ingelogd. Dat gaat via de definer-functie
-- public.calendar_feed_events, waar het token de hele afscherming is.

create policy "calendar_feeds_select_own" on public.calendar_feeds
  for select
  using (player_id = (select auth.uid()));
