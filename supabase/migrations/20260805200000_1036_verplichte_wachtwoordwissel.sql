-- #1036 Adminpaneel deel 2: de verplichte wachtwoordwissel.
--
-- Deelt een beheerder een tijdelijk wachtwoord uit, dan moet die gebruiker het
-- bij de eerstvolgende login zelf vervangen. Supabase heeft daar niets voor, dus
-- we doen het zelf: een vlag op profiles, gezet door de edge function met de
-- service-role, en gewist door een trigger zodra er écht een nieuw wachtwoord
-- staat.
--
-- Spiegel van supabase/schemas/tables/01_profiles.sql; zie daar de volledige
-- motivatie. Met de hand geschreven omdat `supabase db diff` op develop niet
-- draait door de schemadrift van #825.

-- 1. De vlag ----------------------------------------------------------------

alter table public.profiles
  add column moet_wachtwoord_wijzigen boolean not null default false;

-- Bewust GEEN uitbreiding van de grant-update-lijst uit #465. Nieuwe kolommen
-- erven geen kolom-grant, dus authenticated kan deze niet schrijven en een
-- poging faalt met 42501 nog vóór RLS. Dat is de hele bewaking: wie zijn eigen
-- vlag kan uitzetten, kan met een tijdelijk wachtwoord blijven rondlopen.
-- De pgTAP-suite verplichte_wachtwoordwissel_test.sql zet dat vast.

-- 2. De trigger die hem weer uitzet -----------------------------------------

-- SECURITY DEFINER is noodzakelijk: GoTrue schrijft als supabase_auth_admin en
-- die rol heeft geen rechten op public.profiles.
create function public.handle_password_changed()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.profiles
     set moet_wachtwoord_wijzigen = false
   where id = new.id and moet_wachtwoord_wijzigen;
  return null;
end;
$$;

-- `of encrypted_password` én de when-clausule: zonder allebei zou élke update op
-- auth.users de vlag wissen — een login schrijft last_sign_in_at — en dan houdt
-- de gedwongen wissel precies één login stand.
create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (new.encrypted_password is distinct from old.encrypted_password)
  execute function public.handle_password_changed();

-- 3. Sessies intrekken -------------------------------------------------------

-- "Overal uitloggen" voor een ander account. De admin-API van GoTrue kan dit
-- niet vanaf de serverkant: auth.admin.signOut(jwt) vraagt een geldig
-- access-token ván die gebruiker, en dat heeft een beheerder per definitie niet.
--
-- Sessies verwijderen is het equivalent: auth.refresh_tokens hangt via session_id
-- met on delete cascade aan auth.sessions, dus één delete trekt de hele keten
-- door. De lopende access-tokens blijven geldig tot ze verlopen (jwt_expiry, één
-- uur) — dat is inherent aan JWT's en niet iets wat we hier kunnen forceren.
create or replace function public.admin_trek_sessies_in(p_uid uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aantal integer;
begin
  delete from auth.sessions where user_id = p_uid;
  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

revoke execute on function public.admin_trek_sessies_in(uuid) from public, anon, authenticated;
grant execute on function public.admin_trek_sessies_in(uuid) to service_role;
