-- Dwingt de privacy-instelling "geen vriendschapsverzoeken ontvangen" af.
-- Additief: bij allow_friend_requests = true (de default) blokkeert dit niets.
create or replace function public.enforce_friend_request_privacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' and exists (
    select 1 from public.profiles p
    where p.id = new.addressee_id and p.allow_friend_requests = false
  ) then
    raise exception 'Deze speler ontvangt geen vriendschapsverzoeken.';
  end if;
  return new;
end;
$$;

create trigger friendships_privacy_check
  before insert on public.friendships
  for each row execute function public.enforce_friend_request_privacy();
