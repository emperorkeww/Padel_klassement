-- Uitnodigingslinks voor groepen: aanmaken (elk lid, #776) en inwisselen
-- (auto-join).
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
  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'Alleen leden van deze groep kunnen een uitnodiging maken';
  end if;

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
