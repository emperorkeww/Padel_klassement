-- Notificatie-voorkeuren (#57): per push-type aan/uit, gerespecteerd door de
-- edge functions send-push en match-reminders. Alle vier standaard 'true',
-- zodat bestaande gebruikers alles blijven ontvangen.
--   notify_new_round       -> nieuwe ronde gegenereerd (match staat klaar)
--   notify_result          -> uitslag van jouw match ingevoerd
--   notify_friend_request  -> nieuw vriendschapsverzoek
--   notify_match_reminder  -> herinnering vóór een geplande match
alter table public.profiles
  add column if not exists notify_new_round boolean not null default true,
  add column if not exists notify_result boolean not null default true,
  add column if not exists notify_friend_request boolean not null default true,
  add column if not exists notify_match_reminder boolean not null default true;
