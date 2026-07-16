-- RPC: verwijder een match (geplande én afgeronde). Veilig want de stand is een
-- live view en de ratings worden na elke wijziging aan public.matches automatisch
-- bijgewerkt (trigger matches_ratings_del); rating_history hangt met
-- on delete cascade aan de match. Verwijderen mag door de aanmaker of door de
-- eigenaar van de groep waarin de match hoort.
create or replace function public.delete_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_created_by uuid;
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select created_by, group_id into v_created_by, v_group_id
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'Match niet gevonden';
  end if;

  if v_created_by is distinct from v_uid
     and not (v_group_id is not null and public.is_group_owner(v_group_id, v_uid)) then
    raise exception 'Alleen de aanmaker of de groepseigenaar kan deze match verwijderen';
  end if;

  delete from public.matches where id = p_match_id;
end;
$$;

grant execute on function public.delete_match(uuid) to authenticated;
