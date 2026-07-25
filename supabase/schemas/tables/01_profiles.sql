-- Roast-intensiteit (#183): hoe hard het systeem iemand roast. Gebruikt door
-- profielen (persoonlijk) én groepen (per groep, alleen de owner stelt het in).
-- Definitie staat hier omdat dit bestand als eerste laadt.
create type public.roast_intensiteit as enum ('mild', 'gemeen', 'radioactief');

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
  -- Waarnemend dictator (#542): cosmetische weergavevoorkeur — toont het
  -- klassement de waarnemend Kylian Mbappé (#530) bovenaan zolang niemand de
  -- El Padelissimo-tier haalt? De dictator-divisie zelf (#527) blijft altijd
  -- bestaan; dit verbergt enkel de meme-figuur. Default 'true' = bestaand gedrag.
  toon_waarnemend_dictator boolean not null default true,
  -- AI dictator-portret (#554): opt-out + opslag van het uit de profielfoto
  -- gegenereerde portret (OpenAI gpt-image-1), getoond op De Troon voor de echte
  -- dictator. dictator_portret 'false' = nooit naar OpenAI, troon toont de gewone
  -- avatar. dictator_avatar_url = publieke URL (null = nog niet / vervallen);
  -- dictator_avatar_bron = de avatar_url waarop het portret is gebaseerd (of de
  -- sentinel '__geen_avatar__'), voor invalidatie bij een fotowissel.
  dictator_portret boolean not null default true,
  dictator_avatar_url text,
  dictator_avatar_bron text,
  -- AI pias-portret (#682): dezelfde drie velden voor De Schandpaal — het
  -- hofnar-portret dat generate-pias-avatar uit de profielfoto maakt. Losse
  -- opt-out van de dictator: wie op de troon wél als generalissimo wil, hoeft
  -- niet ook als hofnar te verschijnen (en omgekeerd).
  pias_portret boolean not null default true,
  pias_avatar_url text,
  pias_avatar_bron text,
  -- Notificatie-voorkeuren (#57): per push-type aan/uit, server-side
  -- gerespecteerd door send-push en match-reminders. Standaard alles aan.
  notify_new_round boolean not null default true,
  notify_result boolean not null default true,
  notify_friend_request boolean not null default true,
  notify_match_reminder boolean not null default true,
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

-- Guard op de gegenereerde portret-kolommen: dictator (#554) én pias (#682) in
-- één function, want twee guards met bijna-gelijke regels op dezelfde tabel
-- divergeren bij de eerste wijziging die er maar één raakt. Drie taken:
--   1. fotowissel  => beide portretten vervallen (invalidatie);
--   2. geen service-role => client-writes op de url/bron-kolommen terugdraaien,
--      zodat niemand z'n portret kan spoofen (de kolom-grant weigert ze al met
--      42501; dit is de tweede laag);
--   3. opt-out uit => het bewaarde portret nullen ("uit" = weg, niet "verborgen").
-- SECURITY INVOKER, zodat current_role de echte aanroeper weerspiegelt.
create function public.profiles_ai_portret_guard()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.avatar_url is distinct from old.avatar_url then
    new.dictator_avatar_url := null;
    new.dictator_avatar_bron := null;
    new.pias_avatar_url := null;
    new.pias_avatar_bron := null;
  elsif current_role <> 'service_role' then
    new.dictator_avatar_url := old.dictator_avatar_url;
    new.dictator_avatar_bron := old.dictator_avatar_bron;
    new.pias_avatar_url := old.pias_avatar_url;
    new.pias_avatar_bron := old.pias_avatar_bron;
  end if;
  if new.dictator_portret is false then
    new.dictator_avatar_url := null;
    new.dictator_avatar_bron := null;
  end if;
  if new.pias_portret is false then
    new.pias_avatar_url := null;
    new.pias_avatar_bron := null;
  end if;
  return new;
end;
$$;

create trigger profiles_ai_portret_guard
  before update on public.profiles
  for each row execute function public.profiles_ai_portret_guard();