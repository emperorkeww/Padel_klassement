-- RPC: stel vrienden voor aan de ingelogde gebruiker.
-- Prioriteit op gemeenschappelijke vrienden (mutual_count desc), daarna willekeurig aangevuld.
-- SECURITY DEFINER omdat vrienden-van-vrienden buiten de eigen RLS-zichtbaarheid vallen.
-- mutual_ids bevat de id's van de gemeenschappelijke vrienden (de client toont hun namen).
create or replace function public.get_friend_suggestions(p_limit int default 12)
returns table (id uuid, mutual_count int, mutual_ids uuid[])
language sql
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as uid),
  -- Mijn geaccepteerde vrienden.
  my_friends as (
    select case when f.requester_id = m.uid then f.addressee_id else f.requester_id end as friend_id
    from public.friendships f, me m
    where f.status = 'accepted' and m.uid in (f.requester_id, f.addressee_id)
  ),
  -- Iedereen met wie ik al enige relatie heb (pending/accepted/declined) -> uitsluiten.
  related as (
    select case when f.requester_id = m.uid then f.addressee_id else f.requester_id end as rid
    from public.friendships f, me m
    where m.uid in (f.requester_id, f.addressee_id)
  ),
  -- Vrienden-van-vrienden met de gemeenschappelijke (geaccepteerde) vrienden.
  fof as (
    select case when f.requester_id = mf.friend_id then f.addressee_id else f.requester_id end as cand,
           count(*)::int as mutual,
           array_agg(mf.friend_id) as mutual_ids
    from public.friendships f
    join my_friends mf on mf.friend_id in (f.requester_id, f.addressee_id)
    where f.status = 'accepted'
    group by 1
  )
  select p.id,
         coalesce(fof.mutual, 0) as mutual_count,
         coalesce(fof.mutual_ids, '{}') as mutual_ids
  from public.profiles p
  left join fof on fof.cand = p.id
  where p.id <> (select uid from me)
    and not p.is_guest
    and p.id not in (select rid from related)
  order by mutual_count desc, random()
  limit p_limit;
$$;

grant execute on function public.get_friend_suggestions(int) to authenticated;
