-- Schakelaars zonder deploy (#1049).
--
-- De enige vlag die de app tot nu toe had is VITE_DEFAULT_DICTATOR, en die zit
-- in de *build*: omzetten is een deploy. De OpenAI-portretten hadden helemaal
-- geen rem — geen dagbudget, geen teller — en uitzetten betekende een secret
-- weghalen bij Supabase, wat de function stilletjes laat no-oppen zonder dat
-- iemand kan zien dát dat de reden is.
--
-- Dit vervangt VITE_DEFAULT_DICTATOR niet: dat is een weergavevoorkeur, geen
-- kill switch.
create table public.app_settings (
  sleutel text primary key,
  waarde jsonb not null,
  -- Mag de ingelogde client deze rij lezen? Standaard nee. Alleen vlaggen die
  -- de UI nodig heeft om een knop te verbergen staan op true — de rest is
  -- serverzaak en gaat de browser niets aan.
  publiek boolean not null default false,
  -- Waar de schakelaar over gaat, in gewone taal. Staat in het paneel naast de
  -- knop, zodat je over een half jaar niet hoeft te raden wat "playtomic" uitzet.
  omschrijving text not null,
  bijgewerkt_at timestamptz not null default now(),
  -- Geen foreign key: net als bij admin_audit_log moet deze rij blijven kloppen
  -- als het account van de beheerder ooit verdwijnt.
  bijgewerkt_door uuid
);

alter table public.app_settings enable row level security;

-- Lezen mag voor publieke vlaggen; schrijven nooit vanaf de client. De
-- service-role gaat hier per definitie omheen en is de enige schrijver.
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to authenticated;

create policy "publieke vlaggen zijn leesbaar"
  on public.app_settings
  for select
  to authenticated
  using (publiek);

-- De drie schakelaars uit het issue. `on conflict do nothing` zodat een herhaalde
-- migratie een gezette waarde niet terugdraait — dat zou een kill switch die
-- iemand net omzette bij de volgende deploy stilletjes weer aanzetten.
insert into public.app_settings (sleutel, waarde, publiek, omschrijving)
values
  -- Dagbudget én aan/uit in één rij: de rem en de schakelaar delen hetzelfde
  -- mechanisme, en verbruik_dagbudget() heeft ze allebei in één transactie nodig.
  ('ai_portretten',
   '{"aan": true, "dagbudget": 20, "dag": null, "gebruikt": 0}'::jsonb,
   -- Publiek: de UI moet de knop "genereer portret" kunnen verbergen in plaats
   -- van hem te laten falen.
   true,
   'AI-portretten (OpenAI). Uit = generate-*-avatar doet niets. Dagbudget is de rem.'),

  ('playtomic',
   '{"aan": true}'::jsonb,
   false,
   'Baanbeschikbaarheid via de Playtomic-egress (#385). Uit als Playtomic ons weer blokkeert.'),

  ('push',
   '{"aan": true}'::jsonb,
   false,
   'Uitgaande pushmeldingen. Uit = geen web-push meer; de meldingen-inbox (#1090) blijft wél gevuld.')
on conflict (sleutel) do nothing;
