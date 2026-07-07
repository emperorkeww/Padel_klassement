-- Privacy-instellingen op het profiel. Beide standaard 'true', zodat het
-- bestaande gedrag ongewijzigd blijft (iedereen vindbaar, verzoeken open).
--   discoverable            -> verschijn je in het zoeken naar spelers?
--   allow_friend_requests   -> mogen anderen je een vriendschapsverzoek sturen?
alter table public.profiles
  add column if not exists discoverable boolean not null default true,
  add column if not exists allow_friend_requests boolean not null default true;

-- Dwing "geen verzoeken ontvangen" ook in de databank af, niet alleen in de UI.
-- Additief: bij allow_friend_requests = true (de default) verandert er niets.
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
