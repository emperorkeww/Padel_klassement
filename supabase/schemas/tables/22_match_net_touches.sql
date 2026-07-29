-- Netrollers per speler per match (#809): hoe vaak ging de bal via de netband
-- alsnog binnen. Ruwe invoerdata, geen afgeleide state — de Netroller-badge
-- wordt er client-side uit afgeleid, net als alle andere badges.
--
-- Bewust een eigen tabel en niet match_points: die is punt-voor-punt bedoeld
-- en wordt door geen enkele flow gevuld. Hier gaat het om één teller per
-- (match, speler), die de speler zelf achteraf invult of corrigeert.
create table public.match_net_touches (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  -- 0 is toegestaan: zo kan je een verkeerde invoer terugzetten zonder de rij
  -- te moeten verwijderen. De bovengrens houdt onzin (en de badge) in toom.
  aantal smallint not null check (aantal between 0 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

-- Het profiel leest alle netrollers van één speler in één query.
create index match_net_touches_player_idx on public.match_net_touches (player_id);

alter table public.match_net_touches enable row level security;
