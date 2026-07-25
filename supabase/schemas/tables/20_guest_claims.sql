-- Koppelverzoeken voor gastspelers (#681). Een gast (profiles.is_guest) speelt
-- volwaardig mee en bouwt matchhistorie en Elo op; maakt die persoon later écht
-- een account aan, dan staat die historie op het verkeerde profiel. De eigenaar
-- van de gast (owner_id) vraagt de koppeling aan, het echte account bevestigt
-- of weigert — zonder bevestiging schrijft niemand historie op andermans naam.
--
-- Alleen de RPC's uit functions/27_guest_claims.sql schrijven in deze tabel;
-- de client leest 'm enkel (zie policies/guest_claims.sql).
--
-- Bewust géén 'accepted'-status: bij een geslaagde koppeling verdwijnt het
-- gastprofiel en cascadeert de rij mee. Een verzoek is dus altijd óf open, óf
-- afgewezen/ingetrokken, óf verdwenen omdat het gelukt is.
create table public.guest_claims (
  id uuid primary key default gen_random_uuid(),
  -- De gast wiens historie verhuist.
  guest_id uuid not null references public.profiles (id) on delete cascade,
  -- Het echte account dat de historie overneemt; bevestigt zelf.
  player_id uuid not null references public.profiles (id) on delete cascade,
  -- De eigenaar van de gast, die het verzoek startte. Apart van guest_id
  -- opgeslagen omdat de gast na een geslaagde koppeling verdwijnt.
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_claims_distinct check (guest_id <> player_id)
);

-- Hoogstens één openstaand verzoek per gast: anders zouden twee spelers
-- tegelijk dezelfde historie kunnen claimen.
create unique index guest_claims_open_uidx
  on public.guest_claims (guest_id)
  where status = 'pending';

-- "Heb ik openstaande verzoeken?" is de hoofdquery van de ontvanger.
create index guest_claims_player_idx
  on public.guest_claims (player_id)
  where status = 'pending';

alter table public.guest_claims enable row level security;
