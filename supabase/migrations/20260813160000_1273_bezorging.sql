-- De bezorging temmen (#1273), tweede helft.
--
-- 1. "🔔 Herinner de groep" had geen enkele rem: remind-group pusht naar
--    iedereen die nog niet gestemd heeft, en de knop verbergt zichzelf alleen
--    in client-state (`remindedDone`). Een paginaverversing brengt hem terug,
--    en elk ander groepslid heeft zijn eigen knop. Met `renotify: true` erbij
--    kon één poll een groep onbeperkt vaak laten trillen.
--    Zelfde vorm als de dedup-stempels die er al staan (deadline_notified_at,
--    dayof_notified_at): een timestamp op de poll, gezet ná de bezorging.
alter table public.play_polls
  add column if not exists remind_notified_at timestamptz;

comment on column public.play_polls.remind_notified_at is
  'Laatste handmatige "herinner de groep" (#1273). Cooldown in remind-group.';

-- 2. De instellingenkaart heet "Pushmeldingen op dit apparaat" en toonde er
--    precies nul. Zonder iets van herkenning is een lijst van endpoints
--    onleesbaar (een capability-URL van 200 tekens), dus slaan we op waarmee
--    het abonnement gemaakt is. Privacy-arm: je ziet alleen je eigen rijen
--    (RLS push_select_own), en de service-role zag ze sowieso al.
alter table public.push_subscriptions
  add column if not exists user_agent text;

comment on column public.push_subscriptions.user_agent is
  'Waarmee dit abonnement gemaakt is (#1273), zodat de apparatenlijst een naam kan tonen.';
