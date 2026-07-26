-- #776: niet alleen de eigenaar, maar elk lid van een groep kan nieuwe leden
-- toevoegen (vrienden, eigen gasten) en een uitnodigingslink maken. Spiegel van
-- supabase/schemas/policies/group_members.sql, supabase/schemas/policies/
-- group_invites.sql en supabase/schemas/functions/14_group_invites.sql; zie die
-- bestanden voor de toelichting.
--
-- Verwijderen blijft bewust owner-only: toevoegen is een uitnodiging, eruit
-- zetten is een ingreep. De delete-policy op group_members (eigenaar of het lid
-- zelf) en het intrekken van een uitnodigingslink veranderen dus niet.
--
-- De role-kolom op group_members ('owner'/'member') blijft ongebruikt in de
-- policies; alles leunt nog op groups.created_by via is_group_owner.

-- group_members: toevoegen mag elk lid. De tweede voorwaarde blijft de rem —
-- je voegt alleen jezelf, een geaccepteerde vriend of je eigen gast toe.
drop policy if exists "Eigenaar kan vrienden toevoegen" on public.group_members;

create policy "Lid kan vrienden toevoegen"
  on public.group_members for insert
  to authenticated
  with check (
    public.is_group_member(group_id, (select auth.uid()))
    and (
      player_id = (select auth.uid())
      or public.are_friends((select auth.uid()), player_id)
      or public.is_own_guest((select auth.uid()), player_id)
    )
  );

-- group_invites: zien en aanmaken mag elk lid; intrekken blijft de eigenaar.
drop policy if exists "Eigenaar ziet uitnodigingen" on public.group_invites;

create policy "Lid ziet uitnodigingen"
  on public.group_invites for select
  to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

drop policy if exists "Eigenaar maakt uitnodiging" on public.group_invites;

create policy "Lid maakt uitnodiging"
  on public.group_invites for insert
  to authenticated
  with check (public.is_group_member(group_id, (select auth.uid())));

-- De RPC draait SECURITY DEFINER en doet zijn eigen toegangscheck; die moet dus
-- mee, anders blijft de uitnodigingslink owner-only ondanks de policies.
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
