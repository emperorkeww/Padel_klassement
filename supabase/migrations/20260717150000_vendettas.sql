-- Vendetta's (#169): verklaarde aartsrivaliteiten tussen groepsgenoten. Zie
-- supabase/schemas/{tables,policies,functions}/*vendettas* voor de bron.
-- Handmatig geschreven i.p.v. db diff: kolomgrants en de realtime-publicatie
-- komen niet mee in de diff, en die zijn hier essentieel (zoals bij
-- match_smoesjes).

create table public.vendettas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  challenger_id uuid not null references public.profiles (id) on delete cascade,
  rival_id uuid not null references public.profiles (id) on delete cascade,
  target_wins smallint not null default 5 check (target_wins in (3, 5, 7)),
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (challenger_id <> rival_id),
  check ((status = 'active') = (ended_at is null))
);

create unique index vendettas_active_pair_uidx
  on public.vendettas (group_id, least(challenger_id, rival_id), greatest(challenger_id, rival_id))
  where status = 'active';

create index vendettas_group_idx on public.vendettas (group_id);

alter table public.vendettas enable row level security;

create or replace function public.vendettas_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_group_member(new.group_id, new.rival_id) then
      raise exception 'je rivaal moet in dezelfde groep zitten';
    end if;
    return new;
  end if;

  -- UPDATE: alleen active → ended; een beëindigde vendetta is bevroren historie.
  if old.status = 'ended' then
    raise exception 'deze vendetta is al beëindigd';
  end if;
  if new.status = 'ended' then
    new.ended_at := now();
  end if;
  return new;
end;
$$;

create trigger vendettas_guard
  before insert or update on public.vendettas
  for each row execute function public.vendettas_guard();

create policy "vendettas_select_member" on public.vendettas
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "vendettas_insert_challenger" on public.vendettas
  for insert
  with check (
    challenger_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

create policy "vendettas_update_involved" on public.vendettas
  for update
  using ((select auth.uid()) in (challenger_id, rival_id))
  with check ((select auth.uid()) in (challenger_id, rival_id));

-- Kolomprivileges (migra neemt kolomprivileges niet mee in de diff): ended_at
-- wordt uitsluitend door de guard-trigger gezet; de client mag alleen de
-- startpayload inserten en enkel status bijwerken.
revoke insert, update on public.vendettas from authenticated;
grant insert (group_id, challenger_id, rival_id, target_wins),
      update (status)
  on public.vendettas to authenticated;

alter publication supabase_realtime add table public.vendettas;
