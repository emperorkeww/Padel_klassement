-- Systeemgezondheid voor het beheerpaneel (#1049).
--
-- De vraag die dit beantwoordt is "draait alles nog?", en het antwoord stond tot
-- nu toe nergens: de cron-schedules zijn met de hand in de SQL-editor gezet
-- (supabase/snippets/*_cron.sql) en pg_cron houdt het resultaat bij in cron.job
-- en cron.job_run_details, twee tabellen die de hele repo alleen noemt in een
-- commentaarblok onderaan appeal_deadline_cron.sql. Wie wilde weten of Rudy's
-- VAR nog liep, moest die query met de hand plakken.
--
-- Waarom een RPC en niet gewoon PostgREST: het `cron`-schema staat niet in
-- config.toml's api.schemas en is dus onbereikbaar via de API — net als `auth`
-- bij #1036. Een security definer-functie in `public` is de enige brug.
--
-- Alleen lezen. Dit scherm repareert niets; het laat zien dát er iets stuk is
-- voordat een speler het meldt.
create or replace function public.admin_systeem_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $fn$
declare
  v_cron jsonb;
  v_tabellen jsonb := '[]'::jsonb;
  v_migratie jsonb;
  v_push jsonb;
  v_tabel text;
  v_aantal bigint;
begin
  -- 1. De cron-jobs ---------------------------------------------------------
  --
  -- pg_cron draait alleen op het gehoste project; lokaal bestaat het schema
  -- niet. Dat is geen fout maar de normale toestand van een dev-machine, dus
  -- geeft dit blok `null` terug (= "niet beschikbaar") in plaats van te
  -- ontploffen. De UI toont dat als zodanig.
  --
  -- LET OP: `cron.job.command` bevat de volledige SQL van de job, inclusief het
  -- letterlijke CRON_SECRET uit de snippets. Die kolom komt hier dus bewust
  -- niet in voor, en `return_message` wordt gemaskeerd — een foutmelding van
  -- pg_net kan de aanroepende statement citeren en daarmee het geheim mee naar
  -- buiten nemen.
  if to_regclass('cron.job') is null then
    v_cron := null;
  else
    execute $q$
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'jobname',         s.jobname,
                 'schedule',        s.schedule,
                 'actief',          s.active,
                 'laatste_start',   s.start_time,
                 'laatste_einde',   s.end_time,
                 'laatste_status',  s.status,
                 'laatste_bericht', s.bericht
               ) order by s.jobname), '[]'::jsonb)
        from (
          select j.jobname,
                 j.schedule,
                 j.active,
                 d.start_time,
                 d.end_time,
                 d.status,
                 left(regexp_replace(coalesce(d.return_message, ''),
                                     '(x-cron-secret[^,)]*)', '[geheim]', 'gi'),
                      300) as bericht
            from cron.job j
            left join lateral (
              select r.start_time, r.end_time, r.status, r.return_message
                from cron.job_run_details r
               where r.jobid = j.jobid
               order by r.start_time desc
               limit 1
            ) d on true
        ) s
    $q$ into v_cron;
  end if;

  -- 2. Rijen per kerntabel --------------------------------------------------
  --
  -- Exacte tellingen en geen n_live_tup-schatting uit pg_stat_user_tables: dit
  -- zijn de tabellen van één padelclub, dus een count is goedkoop, en een
  -- schatting die na een restore nog 0 zegt is erger dan geen getal.
  -- De to_regclass-guard is er niet voor de sier: deze functie draait ook op
  -- een lokale databank die achterloopt op develop, en een tabel die daar nog
  -- niet bestaat hoort een regel over te slaan, niet het hele scherm te breken.
  foreach v_tabel in array array[
    'profiles', 'groups', 'group_members', 'matches', 'teams',
    'player_ratings', 'play_polls', 'notifications', 'push_subscriptions',
    'point_appeals'
  ] loop
    if to_regclass('public.' || v_tabel) is not null then
      execute format('select count(*) from public.%I', v_tabel) into v_aantal;
      v_tabellen := v_tabellen || jsonb_build_object('tabel', v_tabel, 'rijen', v_aantal);
    end if;
  end loop;

  -- 3. De laatst toegepaste migratie ----------------------------------------
  if to_regclass('supabase_migrations.schema_migrations') is null then
    v_migratie := null;
  else
    execute $q$
      select jsonb_build_object('versie', m.version, 'naam', m.name)
        from supabase_migrations.schema_migrations m
       order by m.version desc
       limit 1
    $q$ into v_migratie;
  end if;

  -- 4. Push -----------------------------------------------------------------
  --
  -- Wat hier NIET staat: hoeveel abonnementen er de laatste week zijn opgeruimd
  -- na een 404/410. meldingenBezorger.ts verwijdert die rijen, dus dat getal
  -- bestaat nergens; het bijhouden vraagt een soft-delete of een teller en is
  -- bewust geen onderdeel van deze PR.
  select jsonb_build_object(
           'abonnementen', count(*),
           'gebruikers',   count(distinct p.user_id),
           'oudste',       min(p.created_at),
           'nieuwste',     max(p.created_at)
         )
    into v_push
    from public.push_subscriptions p;

  return jsonb_build_object(
    'cron',     v_cron,
    'tabellen', v_tabellen,
    'migratie', v_migratie,
    'push',     v_push,
    'gemeten_op', now()
  );
end;
$fn$;

revoke execute on function public.admin_systeem_status() from public, anon, authenticated;
grant execute on function public.admin_systeem_status() to service_role;
