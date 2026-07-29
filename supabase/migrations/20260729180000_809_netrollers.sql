-- Netrollers per speler per match (#809).
--
-- Spiegel van:
--   supabase/schemas/tables/22_match_net_touches.sql
--   supabase/schemas/functions/32_match_net_touches.sql
--   supabase/schemas/policies/match_net_touches.sql
--   supabase/schemas/policies/zz_client_read_grants.sql (de select-grant)
--
-- Handgeschreven, niet uit `supabase db diff` overgenomen: die genereert hier
-- spurious drops voor dictator_termijnen, player_rank_state en
-- profiles.notify_rank_change (objecten die alleen in migraties bestaan, zie
-- #698/#825) en laat kolom-grants weg.

create table public.match_net_touches (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  aantal smallint not null check (aantal between 0 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index match_net_touches_player_idx on public.match_net_touches (player_id);

alter table public.match_net_touches enable row level security;

-- Guard: speler stond in de match, de match is afgerond, updated_at serverside.
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

create policy "match_net_touches_select_zichtbaar" on public.match_net_touches
  for select
  using (
    exists (
      select 1
      from public.matches m
      where m.id = match_id
        and (
          m.group_id is null
          or public.is_group_member(m.group_id, (select auth.uid()))
          or public.is_team_member(m.team_a_id, (select auth.uid()))
          or public.is_team_member(m.team_b_id, (select auth.uid()))
          or m.created_by = (select auth.uid())
        )
    )
  );

create policy "match_net_touches_insert_own" on public.match_net_touches
  for insert
  to authenticated
  with check (player_id = (select auth.uid()));

create policy "match_net_touches_update_own" on public.match_net_touches
  for update
  to authenticated
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy "match_net_touches_delete_own" on public.match_net_touches
  for delete
  to authenticated
  using (player_id = (select auth.uid()));

-- Tabelgrants: PostgREST heeft die naast RLS nodig.
grant select on table public.match_net_touches to authenticated, anon;
revoke insert, update on table public.match_net_touches from authenticated;
grant insert (match_id, player_id, aantal) on table public.match_net_touches to authenticated;
grant update (aantal) on table public.match_net_touches to authenticated;
grant delete on table public.match_net_touches to authenticated;
