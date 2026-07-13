-- #326: verruim de zichtbaarheid van geaccepteerde vriendschappen in de feed.
-- Voorheen (#138) enkel leesbaar als je met béide betrokkenen een groep deelde;
-- nu zodra minstens één partij in je netwerk zit — een groepsgenoot óf een
-- geaccepteerde vriend. Verzoeken (pending/declined) blijven privé.
--
-- De checks lopen via SECURITY DEFINER-helpers zodat de friendships-select-
-- policy geen recursie op public.friendships veroorzaakt.

create or replace function public.shares_group(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.group_members ga
    join public.group_members gb on gb.group_id = ga.group_id
    where ga.player_id = p_a and gb.player_id = p_b
  );
$$;

create or replace function public.is_accepted_friend(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = p_a and f.addressee_id = p_b)
        or (f.requester_id = p_b and f.addressee_id = p_a)
      )
  );
$$;

-- Oude beide-partijen-policy vervangen door de netwerk-regel.
drop policy if exists "friendships_select_groupmates" on public.friendships;

create policy "friendships_select_network" on public.friendships
  for select
  to authenticated
  using (
    status = 'accepted'
    and (
      public.shares_group((select auth.uid()), requester_id)
      or public.shares_group((select auth.uid()), addressee_id)
      or public.is_accepted_friend((select auth.uid()), requester_id)
      or public.is_accepted_friend((select auth.uid()), addressee_id)
    )
  );
