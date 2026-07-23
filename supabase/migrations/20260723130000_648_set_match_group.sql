-- #648: losse match achteraf aan een groep koppelen (of verhangen/loskoppelen).
-- Spiegel van supabase/schemas/functions/26_set_match_group.sql; zie dat
-- bestand voor het volledige permissiemodel. Kern: dit is het enige
-- schrijfpad voor matches.group_id — de kolom-grant uit #432 blijft dicht.
create or replace function public.set_match_group(p_match_id uuid, p_group_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_current_group_id uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select group_id into v_current_group_id
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match niet gevonden';
  end if;

  if v_current_group_id is not distinct from p_group_id then
    return;
  end if;

  if v_current_group_id is not null
     and not public.is_group_member(v_current_group_id, v_uid) then
    raise exception 'Alleen een lid van de huidige groep kan deze match loskoppelen';
  end if;

  if p_group_id is not null
     and not public.is_group_member(p_group_id, v_uid) then
    raise exception 'Alleen een lid van de doelgroep kan deze match koppelen';
  end if;

  update public.matches set group_id = p_group_id where id = p_match_id;
end;
$$;

grant execute on function public.set_match_group(uuid, uuid) to authenticated;
