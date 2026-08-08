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
-- De schakelaars lezen, zetten en verbruiken (#1049).

-- 1. Het dagbudget van de AI-portretten ---------------------------------------
--
-- De schakelaar en de rem delen hetzelfde mechanisme, dus ook dezelfde rij en
-- dezelfde transactie. Eén aanroep beantwoordt "mag deze portretaanvraag door?"
-- en boekt hem meteen af.
--
-- `for update` is hier geen sier: twee gelijktijdige portretaanvragen die
-- allebei `gebruikt` lezen, ophogen en terugschrijven, verliezen er één — en
-- dan is een dagbudget van 20 in de praktijk geen bovengrens meer. Dit is de
-- enige plek waar dat kan misgaan, want dit is de enige schrijver.
create or replace function public.verbruik_dagbudget(p_sleutel text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_waarde jsonb;
  v_vandaag text := to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
  v_gebruikt integer;
  v_budget integer;
begin
  select waarde into v_waarde
    from public.app_settings
   where sleutel = p_sleutel
   for update;

  -- Onbekende sleutel: toestaan. Een ontbrekende rij mag geen functie
  -- stilleggen die het gisteren nog deed — dan is een vergeten migratie een
  -- storing in plaats van een no-op.
  if not found then
    return jsonb_build_object('toegestaan', true, 'reden', 'geen-instelling');
  end if;

  if coalesce((v_waarde->>'aan')::boolean, true) is not true then
    return jsonb_build_object('toegestaan', false, 'reden', 'uit');
  end if;

  v_budget := coalesce((v_waarde->>'dagbudget')::integer, 0);

  -- Geen budget ingesteld: alleen de aan/uit-schakelaar telt.
  if v_budget <= 0 then
    return jsonb_build_object('toegestaan', true, 'reden', 'geen-budget');
  end if;

  -- Nieuwe dag: teller terug naar nul. Bewust UTC en niet de clubtijdzone —
  -- dit is een kostenrem, geen speelschema, en een vaste dagrand is genoeg.
  if coalesce(v_waarde->>'dag', '') <> v_vandaag then
    v_gebruikt := 0;
  else
    v_gebruikt := coalesce((v_waarde->>'gebruikt')::integer, 0);
  end if;

  if v_gebruikt >= v_budget then
    update public.app_settings
       set waarde = waarde || jsonb_build_object('dag', v_vandaag, 'gebruikt', v_gebruikt)
     where sleutel = p_sleutel;
    return jsonb_build_object(
      'toegestaan', false, 'reden', 'budget-op',
      'gebruikt', v_gebruikt, 'dagbudget', v_budget
    );
  end if;

  v_gebruikt := v_gebruikt + 1;
  update public.app_settings
     set waarde = waarde || jsonb_build_object('dag', v_vandaag, 'gebruikt', v_gebruikt)
   where sleutel = p_sleutel;

  return jsonb_build_object(
    'toegestaan', true, 'reden', 'ok',
    'gebruikt', v_gebruikt, 'dagbudget', v_budget
  );
end;
$$;

revoke execute on function public.verbruik_dagbudget(text) from public, anon, authenticated;
grant execute on function public.verbruik_dagbudget(text) to service_role;

-- 2. Het paneel: alles lezen --------------------------------------------------
--
-- Anders dan de client (die alleen `publiek`-rijen ziet) krijgt de beheerder
-- alles, inclusief de teller.
create or replace function public.admin_app_settings()
returns table (
  sleutel text,
  waarde jsonb,
  publiek boolean,
  omschrijving text,
  bijgewerkt_at timestamptz,
  bijgewerkt_door uuid,
  bijgewerkt_door_username text
)
language sql
security definer
set search_path = ''
stable
as $$
  select s.sleutel, s.waarde, s.publiek, s.omschrijving,
         s.bijgewerkt_at, s.bijgewerkt_door, p.username
    from public.app_settings s
    left join public.profiles p on p.id = s.bijgewerkt_door
   order by s.sleutel;
$$;

revoke execute on function public.admin_app_settings() from public, anon, authenticated;
grant execute on function public.admin_app_settings() to service_role;

-- 3. Het paneel: een schakelaar omzetten --------------------------------------
--
-- Alleen `aan` en `dagbudget` zijn te zetten, en niet de hele jsonb. Een vrije
-- waarde zou de beheerder de teller laten vervalsen of `publiek` laten omzetten
-- — dat laatste maakt een serverzijdige vlag in één klik client-leesbaar.
create or replace function public.admin_zet_app_setting(
  p_sleutel text,
  p_aan boolean,
  p_actor uuid,
  p_dagbudget integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oud jsonb;
  v_nieuw jsonb;
begin
  select waarde into v_oud
    from public.app_settings
   where sleutel = p_sleutel
   for update;

  if not found then
    raise exception 'Onbekende instelling: %', p_sleutel;
  end if;

  v_nieuw := v_oud || jsonb_build_object('aan', p_aan);
  if p_dagbudget is not null then
    v_nieuw := v_nieuw || jsonb_build_object('dagbudget', greatest(0, p_dagbudget));
  end if;

  update public.app_settings
     set waarde = v_nieuw,
         bijgewerkt_at = now(),
         -- De actor komt van de edge function mee en niet uit auth.uid():
         -- deze functie draait onder de service-role, en daar is auth.uid()
         -- null. Stilzwijgend null wegschrijven maakt het spoor waardeloos.
         bijgewerkt_door = p_actor
   where sleutel = p_sleutel;

  return jsonb_build_object('oud', v_oud, 'nieuw', v_nieuw);
end;
$$;

revoke execute on function public.admin_zet_app_setting(text, boolean, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.admin_zet_app_setting(text, boolean, uuid, integer) to service_role;
