-- #923: een uitnodigingslink laat eerst zien wáár je lid van wordt.
--
-- De preview kan niet client-side: `groups` en `group_members` zijn alleen
-- leesbaar voor leden (RLS), en juist een niet-lid moet de groepsnaam zien
-- vóór hij op "Word lid" drukt. Vandaar een SECURITY DEFINER-functie die op
-- het token — een ongeraden uuid dat je alleen hebt als je de link kreeg —
-- precies zoveel prijsgeeft als op het scherm hoort: naam, ledental, de
-- eerste paar leden en wie de link maakte.
--
-- Spiegel van supabase/schemas/functions/14_group_invites.sql.

create or replace function public.group_invite_preview(p_token uuid)
returns table (
  status text,
  group_id uuid,
  group_name text,
  member_count int,
  member_ids uuid[],
  inviter_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.group_invites;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd' using detail = 'niet_ingelogd';
  end if;

  select * into v_invite
  from public.group_invites
  where token = p_token;

  -- Onbekend of ingetrokken token: alleen de status, verder niets. Een
  -- verkeerd geraden token mag geen groepsnaam opleveren.
  if v_invite.group_id is null then
    return query
    select 'unknown'::text, null::uuid, null::text, null::int,
           null::uuid[], null::uuid, null::timestamptz;
    return;
  end if;

  return query
  select
    -- Volgorde is bewust: wie al lid is hoort de groep in te gaan, ook als de
    -- link intussen verlopen is.
    case
      when public.is_group_member(v_invite.group_id, v_uid) then 'member'
      when v_invite.expires_at is not null and v_invite.expires_at <= now()
        then 'expired'
      else 'ok'
    end,
    g.id,
    g.name,
    (select count(*)::int
       from public.group_members m
      where m.group_id = g.id),
    (select coalesce(array_agg(m.player_id), '{}'::uuid[])
       from (select mm.player_id
               from public.group_members mm
              where mm.group_id = g.id
              order by mm.joined_at, mm.player_id
              limit 8) m),
    v_invite.created_by,
    v_invite.expires_at
  from public.groups g
  where g.id = v_invite.group_id;
end;
$$;

grant execute on function public.group_invite_preview(uuid) to authenticated;

-- Inwisselen zelf verandert niet, op één punt na: de twee afwijzingen dragen
-- nu een stabiele code in DETAIL (PostgREST geeft die door als `details`).
-- De UI hing eerst aan de Nederlandse foutzin om "verlopen" van "bestaat niet"
-- te onderscheiden; dat brak zodra iemand de tekst mooier maakte.
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
    raise exception 'Niet ingelogd' using detail = 'niet_ingelogd';
  end if;

  select group_id, expires_at into v_group_id, v_expires
  from public.group_invites
  where token = p_token;

  if v_group_id is null then
    raise exception 'Deze uitnodiging bestaat niet (meer)'
      using detail = 'uitnodiging_onbekend';
  end if;
  if v_expires is not null and v_expires <= now() then
    raise exception 'Deze uitnodiging is verlopen'
      using detail = 'uitnodiging_verlopen';
  end if;

  insert into public.group_members (group_id, player_id, role)
  values (v_group_id, v_uid, 'member')
  on conflict do nothing;

  return v_group_id;
end;
$$;

grant execute on function public.redeem_group_invite(uuid) to authenticated;
