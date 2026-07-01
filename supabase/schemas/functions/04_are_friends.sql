-- Zijn twee spelers geaccepteerde vrienden? (beide richtingen)
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b)
        or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;