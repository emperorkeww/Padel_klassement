-- #322 hotfix: geef de club-kolommen een DEFAULT (thuisclub). De kolommen zijn
-- NOT NULL, maar de vorige migratie zette geen default. Een insert zónder
-- locatie (de productie-frontend van vóór de bijbehorende deploy stuurt nog geen
-- club_* mee) brak daardoor op de NOT NULL. Met een default werkt zo'n insert
-- weer (valt terug op de thuisclub); de nieuwe frontend zet de club expliciet.
alter table public.play_polls
  alter column club_id set default '91d8d419-3736-498e-90be-362de786d588',
  alter column club_name set default 'LAGO CLUB Padel Beveren',
  alter column club_city set default 'Beveren',
  alter column club_timezone set default 'Europe/Brussels';
