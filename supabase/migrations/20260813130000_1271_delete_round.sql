-- #1271 Een ronde wissen — spiegel van
-- supabase/schemas/functions/45_delete_round.sql; zie dat bestand voor de
-- motivatie.
--
-- Er was geen weg terug van een verkeerd gegenereerde ronde: alleen match voor
-- match via ⋯ → "Verwijderen", zes seconden undo, keer drie banen keer N
-- rondes. Met de hand geschreven; `db diff` draait op develop niet meer.

-- RPC: verwijder een hele ronde van één speeldag (#1271).
--
-- Er was geen weg terug. Zette je per ongeluk vijf rondes klaar, dan was de
-- enige uitweg: per match ⋯ → "Verwijderen" → zes seconden undo, keer drie
-- banen keer vijf rondes. En "opnieuw genereren" bestond helemaal niet — je
-- kon er alleen nóg een ronde bijmaken.
--
-- Alleen geplande matches. Een ronde met uitslagen weggooien is iets heel
-- anders: dat raakt de stand, de Elo-keten en de statistieken van vier mensen,
-- en daar is `delete_match` voor — per match, met de undo-strook erbij.
--
-- De dag hoort erbij sinds rondes binnen hun speeldag tellen (#1271): twee
-- avonden dragen allebei een "ronde 1", en zonder datum zou je ze samen wissen.
create or replace function public.delete_round(
  p_group_id uuid,
  p_round_number smallint,
  p_dag date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_aantal integer;
  v_vreemd integer;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'Geen toegang tot deze groep';
  end if;

  -- Dezelfde kring als delete_match: de aanmaker of de groepseigenaar. Voor een
  -- hele ronde betekent "de aanmaker" dat je élke match ervan aanmaakte —
  -- anders wist je andermans werk mee.
  if not public.is_group_owner(p_group_id, v_uid) then
    select count(*) into v_vreemd
    from public.matches
    where group_id = p_group_id
      and round_number = p_round_number
      and (coalesce(played_at, created_at) at time zone 'Europe/Brussels')::date = p_dag
      and created_by is distinct from v_uid;
    if v_vreemd > 0 then
      raise exception 'Alleen wie de ronde klaarzette of de groepseigenaar kan hem wissen';
    end if;
  end if;

  select count(*) into v_vreemd
  from public.matches
  where group_id = p_group_id
    and round_number = p_round_number
    and (coalesce(played_at, created_at) at time zone 'Europe/Brussels')::date = p_dag
    and status <> 'scheduled';
  if v_vreemd > 0 then
    raise exception 'Deze ronde heeft al uitslagen; verwijder die matches los.';
  end if;

  delete from public.matches
  where group_id = p_group_id
    and round_number = p_round_number
    and (coalesce(played_at, created_at) at time zone 'Europe/Brussels')::date = p_dag
    and status = 'scheduled';

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

grant execute on function public.delete_round(uuid, smallint, date) to authenticated;
