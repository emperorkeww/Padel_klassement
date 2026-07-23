-- Pias van de week (#127-easter egg, nu echt; #643 verbreed): per groep, per
-- ISO-week één speler aangeduid als "pias" — sinds #643 niet meer alleen de
-- grootste choke, maar de anti-MVP volgens dezelfde regels als bepaalPias
-- (src/features/groups/maandpias.ts): bagel, afdroging, zwarte reeks of choke.
-- Zo wijzen dashboard-alarm, banner, feed én FUT-kaart dezelfde persoon aan.
--
-- Afgeleide data, zelfde model als player_ratings/rating_history: leesbaar voor
-- groepsleden, maar enkel de SECURITY DEFINER recompute-functie
-- (functions/20_pias_of_week.sql) schrijft erin — vandaar geen write-policies.
create table public.pias_of_week (
  group_id   uuid not null references public.groups (id)   on delete cascade,
  iso_year   smallint not null,
  iso_week   smallint not null,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  -- Ankermatch: de laatste verloren match van de pias in die (groep, week) —
  -- gebruikt om het feed-item te dateren.
  match_id   uuid not null references public.matches (id)  on delete cascade,
  -- Waarom deze speler de pias is (#643), spiegel van PiasReden in maandpias.ts.
  reden      text not null check (reden in ('bagel', 'afdroging', 'zwarte-reeks', 'choke')),
  -- Ernst-score om kandidaten te rangschikken; hoger = gênanter. Zelfde
  -- formules als ergsteRedenVoor (bagel 100+10n, afdroging 50+marge,
  -- zwarte reeks 40+n, choke 30+round(kans*10)).
  ernst      smallint not null,
  -- Het reden-specifieke getal: bagels-aantal, verliesmarge (games),
  -- reekslengte of winkans (0–1) — voedt de omschrijving (piasDetail).
  waarde     numeric not null,
  -- Pre-match winkans van het verliezende favorietenteam; alleen gevuld bij
  -- reden 'choke' (uit rating_history.rating_before).
  win_chance numeric check (win_chance is null or (win_chance > 0 and win_chance < 1)),
  -- Maandag van de ISO-week; puur voor weergave en sortering.
  week_start date not null,
  created_at timestamptz not null default now(),
  primary key (group_id, iso_year, iso_week)
);

create index pias_of_week_group_idx on public.pias_of_week (group_id);
