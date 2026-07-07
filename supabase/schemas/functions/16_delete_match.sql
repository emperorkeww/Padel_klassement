-- RPC: verwijder een match. VEILIGE keuze: alleen de aanmaker, en alleen zolang
-- de match NIET is afgerond. Een afgeronde match verwijderen zou de
-- seizoensstand en de (uit matches herrekende) ratings aantasten, dus dat
-- blokkeren we bewust. Geplande/geannuleerde matches mogen weg.
create or replace function public.delete_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_created_by uuid;
  v_status public.match_status;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select created_by, status into v_created_by, v_status
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'Match niet gevonden';
  end if;
  if v_created_by is distinct from v_uid then
    raise exception 'Alleen de aanmaker kan deze match verwijderen';
  end if;
  if v_status = 'completed' then
    raise exception 'Een afgeronde match kan niet verwijderd worden (dat zou de stand en ratings aantasten)';
  end if;

  delete from public.matches where id = p_match_id;
end;
$$;

grant execute on function public.delete_match(uuid) to authenticated;
