-- Profielen: echte spelers zijn 1-op-1 met auth.users; gasten (is_guest) zijn
-- naamloze deelnemers zonder account, aangemaakt door een speler (owner_id).
-- Daarom géén FK van id naar auth.users: die zou gasten onmogelijk maken. De
-- cascade-delete bij het verwijderen van een auth-gebruiker regelt de trigger
-- on_auth_user_deleted hieronder.
create table public.profiles (
  id uuid primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  -- Privacy: verschijn je in het zoeken naar spelers, en mogen anderen je een
  -- vriendschapsverzoek sturen? Beide standaard 'true' = bestaand gedrag.
  discoverable boolean not null default true,
  allow_friend_requests boolean not null default true,
  -- Door de speler uitgelichte badges (geordende lijst van badge-id's), die
  -- bovenaan zijn profiel verschijnen. Leeg = niets uitgelicht.
  featured_badges text[] not null default '{}',
  -- Roast-schild (#183): zet de speler dit aan, dan roast het systeem hem niet
  -- meer — pias/feed/profiel tonen dan een neutrale, feitelijke variant. Default
  -- 'false' = schild neer = bestaand gedrag.
  roast_schild boolean not null default false,
  -- Persoonlijke roast-intensiteit (#183): hoe hard Coach Rudy de speler in zijn
  -- eigen feed en dashboard toespreekt. Los van de per-groep intensiteit (die de
  -- eigenaar zet); deze bepaalt enkel niet-groep-gescoopte, persoonlijke roasts.
  -- Default 'gemeen' = bestaand gedrag. Het schild blijft de harde opt-out.
  roast_intensiteit public.roast_intensiteit not null default 'gemeen',
  -- Gastspeler zonder account, en (voor een gast) de speler die hem aanmaakte.
  is_guest boolean not null default false,
  owner_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Een gast heeft altijd een eigenaar; een echte gebruiker nooit.
  constraint profiles_guest_owner_chk check (is_guest = (owner_id is not null))
);

-- Automatisch een profile aanmaken bij signup. De gebruikersnaam komt uit de
-- signup-metadata en wordt gededupliceerd, zodat registratie nooit faalt op
-- een dubbele username.
create function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_base text;
  v_username text;
  v_suffix int := 0;
begin
  v_base := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );
  -- spaties -> underscores, kleine letters; leeg -> 'speler'
  v_base := regexp_replace(lower(v_base), '\s+', '_', 'g');
  if v_base = '' then
    v_base := 'speler';
  end if;

  v_username := v_base;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_suffix := v_suffix + 1;
    v_username := v_base || v_suffix;
  end loop;

  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    v_username,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Verwijder het profiel wanneer de bijhorende auth-gebruiker verdwijnt (vervangt
-- de weggevallen FK-cascade van id -> auth.users). Gasten hebben geen
-- auth-account en worden hierlangs niet geraakt; die vallen onder de
-- owner_id-cascade.
create function public.handle_deleted_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_deleted_user();