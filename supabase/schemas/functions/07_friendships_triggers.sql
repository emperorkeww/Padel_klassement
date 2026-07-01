-- Maak het spelerspaar onveranderlijk na aanmaken. Een RLS with-check kan OLD
-- niet vergelijken, vandaar een trigger (dekt de self-accept-variant waarbij de
-- ontvanger de verzoeker naar een slachtoffer zou herschrijven).
create or replace function public.friendships_freeze_participants()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.requester_id <> old.requester_id
     or new.addressee_id <> old.addressee_id then
    raise exception 'requester_id en addressee_id kunnen niet worden gewijzigd';
  end if;
  return new;
end;
$$;

create trigger friendships_freeze_participants
  before update on public.friendships
  for each row execute function public.friendships_freeze_participants();