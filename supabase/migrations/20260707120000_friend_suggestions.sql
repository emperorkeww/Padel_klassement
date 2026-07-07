set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_friend_suggestions(p_limit int default 12)
 RETURNS TABLE (id uuid, mutual_count int)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (select auth.uid() as uid),
  my_friends as (
    select case when f.requester_id = m.uid then f.addressee_id else f.requester_id end as friend_id
    from public.friendships f, me m
    where f.status = 'accepted' and m.uid in (f.requester_id, f.addressee_id)
  ),
  related as (
    select case when f.requester_id = m.uid then f.addressee_id else f.requester_id end as rid
    from public.friendships f, me m
    where m.uid in (f.requester_id, f.addressee_id)
  ),
  fof as (
    select case when f.requester_id = mf.friend_id then f.addressee_id else f.requester_id end as cand,
           count(*)::int as mutual
    from public.friendships f
    join my_friends mf on mf.friend_id in (f.requester_id, f.addressee_id)
    where f.status = 'accepted'
    group by 1
  )
  select p.id, coalesce(fof.mutual, 0) as mutual_count
  from public.profiles p
  left join fof on fof.cand = p.id
  where p.id <> (select uid from me)
    and p.id not in (select rid from related)
  order by mutual_count desc, random()
  limit p_limit;
$function$;

grant execute on function public.get_friend_suggestions(int) to authenticated;
