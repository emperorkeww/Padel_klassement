-- pgTAP-tests voor public.profiles
begin;

select plan(6);

-- Tabel bestaat
select has_table('public', 'profiles', 'tabel public.profiles bestaat');

-- Row Level Security staat aan
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'RLS staat aan op public.profiles'
);

-- Precies deze policies bestaan
select policies_are(
  'public',
  'profiles',
  array[
    'Profielen zijn publiek leesbaar',
    'Gebruiker kan eigen profiel bijwerken'
  ],
  'profiles heeft de verwachte policies'
);

-- Leespolicy is SELECT, updatepolicy is UPDATE
select policy_cmd_is(
  'public', 'profiles', 'Profielen zijn publiek leesbaar', 'SELECT',
  'leespolicy geldt voor SELECT'
);
select policy_cmd_is(
  'public', 'profiles', 'Gebruiker kan eigen profiel bijwerken', 'UPDATE',
  'updatepolicy geldt voor UPDATE'
);

-- De signup-triggerfunctie bestaat
select has_function(
  'public', 'handle_new_user',
  'functie public.handle_new_user() bestaat'
);

select * from finish();

rollback;