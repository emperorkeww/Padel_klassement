-- handle_new_user: gebruik full_name/username uit de signup-metadata en
-- dedupliceer de gebruikersnaam, zodat registratie nooit faalt op een dubbele
-- username (voorheen brak de trigger de hele signup af).
create or replace function public.handle_new_user()
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
