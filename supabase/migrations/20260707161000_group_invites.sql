-- Deelbare uitnodigingslinks voor groepen. De eigenaar maakt een token aan;
-- wie de link opent en ingelogd is, wisselt het token in en wordt automatisch
-- lid. Het inwisselen loopt via een SECURITY DEFINER-functie, zodat de normale
-- "alleen vrienden toevoegen"-policy op group_members hier niet in de weg zit.

create table public.group_invites (
  token uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index group_invites_group_idx on public.group_invites (group_id);

alter table public.group_invites enable row level security;

-- Alleen de eigenaar van de groep beheert de uitnodigingen ervan. Het inwisselen
-- gebeurt via de definer-functie hieronder en heeft dus geen select-policy nodig.
create policy "Eigenaar ziet uitnodigingen"
  on public.group_invites for select
  to authenticated
  using (public.is_group_owner(group_id, (select auth.uid())));

create policy "Eigenaar maakt uitnodiging"
  on public.group_invites for insert
  to authenticated
  with check (public.is_group_owner(group_id, (select auth.uid())));

create policy "Eigenaar verwijdert uitnodiging"
  on public.group_invites for delete
  to authenticated
  using (public.is_group_owner(group_id, (select auth.uid())));

-- Maakt (of hergebruikt) een uitnodigingslink voor een groep. Alleen de eigenaar.
create or replace function public.create_group_invite(
  p_group_id uuid,
  p_days int default 14
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token uuid;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;
  if not public.is_group_owner(p_group_id, v_uid) then
    raise exception 'Alleen de eigenaar kan een uitnodiging maken';
  end if;

  -- Bestaande, nog geldige link hergebruiken zodat er niet eindeloos tokens
  -- ontstaan.
  select token into v_token
  from public.group_invites
  where group_id = p_group_id
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if v_token is null then
    insert into public.group_invites (group_id, created_by, expires_at)
    values (p_group_id, v_uid, now() + make_interval(days => greatest(p_days, 1)))
    returning token into v_token;
  end if;

  return v_token;
end;
$$;

grant execute on function public.create_group_invite(uuid, int) to authenticated;

-- Wisselt een uitnodigingstoken in: voegt de ingelogde gebruiker toe aan de
-- groep en geeft het groep-id terug (ook als hij al lid was).
create or replace function public.redeem_group_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group_id uuid;
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd';
  end if;

  select group_id, expires_at into v_group_id, v_expires
  from public.group_invites
  where token = p_token;

  if v_group_id is null then
    raise exception 'Deze uitnodiging bestaat niet (meer)';
  end if;
  if v_expires is not null and v_expires <= now() then
    raise exception 'Deze uitnodiging is verlopen';
  end if;

  insert into public.group_members (group_id, player_id, role)
  values (v_group_id, v_uid, 'member')
  on conflict do nothing;

  return v_group_id;
end;
$$;

grant execute on function public.redeem_group_invite(uuid) to authenticated;
