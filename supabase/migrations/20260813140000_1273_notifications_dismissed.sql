-- Meldingen wegvegen (#1273).
--
-- #1090 liet delete bewust weg: "wegveegbaar hoeft ze niet te zijn". Dat klopte
-- voor het toestel — de app ís juist de plek waar je terugvindt wat je daar
-- weggeveegd hebt — maar niet voor de lijst zelf: die kende geen enkele actie
-- per melding behalve openen, en het enige alternatief was "Alles gelezen",
-- alles-of-niets en zonder undo.
--
-- Zacht en niet hard: de rij blijft staan met een dismissed_at, zodat "ongedaan
-- maken" een gewone update is. Een echte delete zou een insert-recht vragen om
-- terug te kunnen, en dat recht is er bewust niet (schrijven doet alleen
-- meldingen_schrijven). prune_notifications ruimt na 90 dagen toch alles op.
alter table public.notifications
  add column if not exists dismissed_at timestamptz;

-- De kolomgrant is het enige wat "welke kolommen mag je wijzigen" regelt; RLS
-- kan dat niet. Opnieuw uitgesproken mét de nieuwe kolom.
revoke insert, update on public.notifications from authenticated;
grant update (read_at, dismissed_at) on public.notifications to authenticated;

comment on column public.notifications.dismissed_at is
  'Weggeveegd door de ontvanger (#1273). De rij blijft staan tot prune_notifications hem opruimt; null = zichtbaar.';
