-- pgTAP-tests voor het baantype op matches (#471): de RPC's bewaren p_court_type
-- en laten het leeg wanneer het niet meegegeven wordt.
begin;

select plan(5);

------------------------------------------------------------------------
-- Fixtures: twee bevriende spelers (profielen via handle_new_user-trigger).
------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000001','authenticated','authenticated','c1@test.nl','x',now(),'{}','{"username":"c1"}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000002','authenticated','authenticated','c2@test.nl','x',now(),'{}','{"username":"c2"}',now(),now(),'','','','');

insert into public.friendships (requester_id, addressee_id, status)
values ('c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','accepted');

set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

------------------------------------------------------------------------
-- 1. create_completed_match bewaart het baantype.
------------------------------------------------------------------------
create temp table cm as
  select public.create_completed_match(
    p_a1 => 'c0000000-0000-0000-0000-000000000001',
    p_a2 => null,
    p_b1 => 'c0000000-0000-0000-0000-000000000002',
    p_b2 => null,
    p_winner => 'a',
    p_score_a => 6::smallint,
    p_score_b => 4::smallint,
    p_court_type => 'panorama') as id;

select is(
  (select court_type from public.matches where id = (select id from cm)),
  'panorama'::public.court_type,
  'create_completed_match bewaart p_court_type');

------------------------------------------------------------------------
-- 2. Zonder p_court_type blijft de kolom leeg.
------------------------------------------------------------------------
create temp table cm_leeg as
  select public.create_completed_match(
    p_a1 => 'c0000000-0000-0000-0000-000000000001',
    p_a2 => null,
    p_b1 => 'c0000000-0000-0000-0000-000000000002',
    p_b2 => null,
    p_winner => 'a',
    p_score_a => 6::smallint,
    p_score_b => 4::smallint) as id;

select is(
  (select court_type from public.matches where id = (select id from cm_leeg)),
  null::public.court_type,
  'zonder p_court_type blijft court_type leeg');

------------------------------------------------------------------------
-- 3. create_planned_match bewaart het baantype.
------------------------------------------------------------------------
create temp table pm as
  select public.create_planned_match(
    p_a1 => 'c0000000-0000-0000-0000-000000000001',
    p_a2 => null,
    p_b1 => 'c0000000-0000-0000-0000-000000000002',
    p_b2 => null,
    p_court_type => 'buiten') as id;

select is(
  (select court_type from public.matches where id = (select id from pm)),
  'buiten'::public.court_type,
  'create_planned_match bewaart p_court_type');
select is(
  (select status from public.matches where id = (select id from pm)),
  'scheduled'::public.match_status,
  'een geplande match met baantype staat op scheduled');

------------------------------------------------------------------------
-- 4. Een onbekende enum-waarde wordt geweigerd.
------------------------------------------------------------------------
select throws_ok(
  $$ select public.create_completed_match(
       p_a1 => 'c0000000-0000-0000-0000-000000000001',
       p_a2 => null,
       p_b1 => 'c0000000-0000-0000-0000-000000000002',
       p_b2 => null,
       p_winner => 'a',
       p_court_type => 'gravel') $$,
  '22P02');

select * from finish();

rollback;
