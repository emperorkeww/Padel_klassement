-- Guard voor de netrollers (#809). Een check-constraint kan niet naar een
-- andere tabel verwijzen, dus een BEFORE-trigger — zelfde aanpak als
-- match_points_validate_team.
--
-- Wat de trigger borgt (en RLS dus niet hoeft te doen):
--   * de speler stond echt in één van de twee teams van de match;
--   * de match is afgerond — vooraf netrollers invullen slaat nergens op;
--   * updated_at wordt serverside gezet, niet door de client.
create or replace function public.match_net_touches_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_speelde boolean;
  v_status public.match_status;
begin
  select m.status,
         exists (
           select 1
           from public.teams t
           where t.id in (m.team_a_id, m.team_b_id)
             and new.player_id in (t.player1_id, t.player2_id)
         )
    into v_status, v_speelde
  from public.matches m
  where m.id = new.match_id;

  if v_status is null then
    raise exception 'match bestaat niet';
  end if;
  if not v_speelde then
    raise exception 'speler stond niet in deze match';
  end if;
  if v_status <> 'completed' then
    raise exception 'netrollers kunnen pas na afloop ingevuld worden';
  end if;

  new.updated_at := now();
  if tg_op = 'UPDATE' then
    -- De sleutel ligt vast; alleen het aantal mag wijzigen.
    new.match_id := old.match_id;
    new.player_id := old.player_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger match_net_touches_guard
  before insert or update on public.match_net_touches
  for each row execute function public.match_net_touches_guard();
