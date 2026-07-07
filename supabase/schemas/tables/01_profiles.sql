-- Profielen: 1-op-1 met auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
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
  created_at timestamptz not null default now()
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