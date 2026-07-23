-- RPC: koppel een match achteraf aan een groep, verhang hem, of maak hem weer
-- groepsloos (#648). Dit is het enige schrijfpad voor matches.group_id: de
-- kolom-grant uit #432 houdt de kolom bewust buiten elke directe UPDATE, want
-- anders zou de aanmaker-policy dat recht als bijvangst meekrijgen.
--
-- Permissiemodel (expliciet beslist in #648):
--   * koppelen aan een groep mag door elk lid van die doelgroep;
--   * loskoppelen of verhangen vergt daarnaast lidmaatschap van de huidige
--     groep (bij verhangen dus lid van beide groepen).
-- De afgeleide data (groepsstand, pias, Zwarte Piet) volgt vanzelf: de
-- statement-level triggers op public.matches herberekenen na deze update en
-- hun recompute ruimt rijen van de oude groep op.
-- p_group_id default null: loskoppelen gaat via PostgREST door de parameter
-- weg te laten (een expliciete null in de payload werkt evengoed).
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
