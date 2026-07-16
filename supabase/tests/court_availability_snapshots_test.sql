-- pgTAP-tests voor public.court_availability_snapshots (#405)
begin;

select plan(6);

-- Tabel bestaat
select has_table(
  'public', 'court_availability_snapshots',
  'tabel public.court_availability_snapshots bestaat'
);

-- Row Level Security staat aan
select is(
  (select relrowsecurity from pg_class
    where oid = 'public.court_availability_snapshots'::regclass),
  true,
  'RLS staat aan op public.court_availability_snapshots'
);

-- Precies één policy: publiek leesbaar
select policies_are(
  'public',
  'court_availability_snapshots',
  array['Beschikbaarheids-snapshots zijn publiek leesbaar'],
  'court_availability_snapshots heeft alleen de leespolicy'
);

select policy_cmd_is(
  'public', 'court_availability_snapshots',
  'Beschikbaarheids-snapshots zijn publiek leesbaar', 'SELECT',
  'leespolicy geldt voor SELECT'
);

-- Testrij als superuser (bypasst RLS, zoals de service-role dat doet).
-- Eigen test-tenant, zodat eventueel al aanwezige echte snapshots
-- (bv. van een lokale run van de edgefunctie) niet in de weg zitten.
insert into public.court_availability_snapshots (tenant_id, date, payload)
values ('00000000-0000-0000-0000-000000000405', current_date, '[]'::jsonb);

-- Ingelogde gebruikers kunnen lezen, maar niet schrijven: RLS heeft geen
-- write-policies, dus alleen de service-role kan snapshots wegschrijven.
set local role authenticated;

select is(
  (select count(*)::int from public.court_availability_snapshots
    where tenant_id = '00000000-0000-0000-0000-000000000405'),
  1,
  'authenticated ziet de snapshot'
);

select throws_ok(
  $$insert into public.court_availability_snapshots (tenant_id, date, payload)
    values ('00000000-0000-0000-0000-000000000405', current_date + 1, '[]'::jsonb)$$,
  '42501',
  'new row violates row-level security policy for table "court_availability_snapshots"',
  'authenticated kan geen snapshot schrijven'
);

reset role;

select * from finish();

rollback;
