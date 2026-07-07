-- Gastspelers: naamloze deelnemers zonder app-account, aangemaakt door een
-- speler. Zie ook tables/01_profiles.sql (is_guest, owner_id).

-- Is p_player een gast van p_owner? Gebruikt in de vrienden-check van de
-- match-RPC's, zodat je je eigen gasten in een match mag opnemen.
create or replace function public.is_own_guest(p_owner uuid, p_player uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = p_player and is_guest and owner_id = p_owner
  );
$$;

-- Maak een gastspeler aan (eigendom van de ingelogde gebruiker). De naam komt
-- in full_name; er wordt een unieke username uit afgeleid.
create or replace function public.create_guest_player(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := nullif(trim(p_name), '');
  v_base text;
  v_username text;
  v_suffix int := 0;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if v_name is null then
    raise exception 'Geef een naam op voor de gast';
  end if;

  v_base := 'gast_' || regexp_replace(lower(v_name), '[^a-z0-9]+', '_', 'g');
  v_base := trim(both '_' from v_base);
  if v_base is null or v_base = '' then
    v_base := 'gast';
  end if;

  v_username := v_base;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_suffix := v_suffix + 1;
    v_username := v_base || v_suffix;
  end loop;

  insert into public.profiles (
    id, username, full_name, is_guest, owner_id, discoverable, allow_friend_requests
  )
  values (
    gen_random_uuid(), v_username, v_name, true, v_uid, false, false
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_guest_player(text) to authenticated;
