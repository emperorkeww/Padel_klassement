-- Vendetta's (#169): guard voor vendettas. Bij het starten moet ook de rivaal
-- groepslid zijn (de insert-policy dekt alleen de uitdager zelf); beëindigen
-- kan één keer, en ended_at wordt hier gezet — de client schrijft enkel status.
create or replace function public.vendettas_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_group_member(new.group_id, new.rival_id) then
      raise exception 'je rivaal moet in dezelfde groep zitten';
    end if;
    return new;
  end if;

  -- UPDATE: alleen active → ended; een beëindigde vendetta is bevroren historie.
  if old.status = 'ended' then
    raise exception 'deze vendetta is al beëindigd';
  end if;
  if new.status = 'ended' then
    new.ended_at := now();
  end if;
  return new;
end;
$$;

create trigger vendettas_guard
  before insert or update on public.vendettas
  for each row execute function public.vendettas_guard();
