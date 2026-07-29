-- #827 deel B: de cron zet zelf rondes klaar als er bij de start van de
-- speeldag nog geen zijn.

-- Dedup in dezelfde stijl als deadline_notified_at / dayof_notified_at.
alter table public.play_polls
  add column if not exists rounds_generated_at timestamptz;

-- Ontsnappingsluik per groep, zelfde vorm als roast_intensiteit: een kolom op
-- groups met een default, door de owner te wijzigen via de bestaande
-- owner-only update-policy.
alter table public.groups
  add column if not exists auto_rondes boolean not null default true;

-- Pas hier wordt het p_created_by-pad uit deel A bereikbaar: de cron draait met
-- de service-role en heeft dus geen auth.uid(). Voor iedereen met een gewone
-- sessie wint auth.uid() nog steeds, dus dit vergroot niet wat een gebruiker kan.
grant execute on function
  public.create_fair_round(uuid, uuid[], timestamptz, uuid) to service_role;
