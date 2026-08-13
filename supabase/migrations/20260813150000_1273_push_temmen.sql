-- De push temmen (#1273).
--
-- Twee gaten die dezelfde vraag onbeantwoord lieten — "wat is deze melding
-- waard?" — en die je alleen kon dichten door de hele app het zwijgen op te
-- leggen:
--
-- 1. Tien van de negentien verstuurmomenten hadden geen schakelaar. `poll` is
--    er in zijn eentje zeven (nieuwe poll, laatste kans, moment gekozen, baan
--    geboekt, afgelast, dag-van, handmatige por) en `var` twee. Juist de
--    soorten die in een actieve groep het vaakst afgaan. (`pias` houdt geen
--    eigen schakelaar: die filtert zichzelf al via roast_schild.)
-- 2. Er was geen bodem onder het uur. poll-deadline draait elk uur, en de
--    momenten komen uit door gebruikers gezette tijden: een speeldag om 08:00
--    levert een "vandaag spelen jullie"-push om 03:05. match-reminders tikt elk
--    kwartier; een ochtendmatch om 09:00 buzzt om 06:00.
--
-- Stille uren staan standaard áán (23:00–07:30). Bewust niet uit: de nachtelijke
-- push is geen keuze die iemand ooit gemaakt heeft, en wie 's nachts wél
-- gepiept wil worden kan het uitzetten. Ze gelden alleen voor de bezorging —
-- de inboxrij wordt hoe dan ook geschreven, precies zoals #1090 het neerzette.
alter table public.profiles
  add column if not exists notify_poll boolean not null default true,
  add column if not exists notify_var boolean not null default true,
  -- null = geen stille uren. Tijd zonder zone: geïnterpreteerd in de clubtijd
  -- (Europe/Brussels), dezelfde vaste zone die poll-deadline al aanhoudt.
  add column if not exists notify_stil_van time default '23:00',
  add column if not exists notify_stil_tot time default '07:30';

-- Nieuwe client-schrijfbare kolommen moeten in de kolomgrant (#465), anders
-- faalt de schakelaar met 42501. Opnieuw uitgesproken met de vier erbij.
revoke update on table public.profiles from authenticated;
grant update (username, full_name, avatar_url, discoverable, allow_friend_requests,
              featured_badges, roast_schild, roast_intensiteit,
              toon_waarnemend_dictator, dictator_portret, pias_portret,
              notify_new_round, notify_result, notify_friend_request,
              notify_match_reminder, notify_rank_change,
              notify_poll, notify_var, notify_stil_van, notify_stil_tot)
  on table public.profiles to authenticated;

comment on column public.profiles.notify_stil_van is
  'Begin van de stille uren in clubtijd (#1273); null = geen stille uren. Alleen de bezorging zwijgt, de inboxrij komt er wel.';
