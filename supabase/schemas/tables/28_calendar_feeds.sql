-- Persoonlijke agenda-feed (#1099): één onraadbare URL per speler waarmee zijn
-- agenda-app zélf ophaalt welke speeldagen vaststaan. Geen app-integratie per
-- provider — elke agenda ter wereld kan een ICS-feed abonneren, en dat is
-- precies waarom dit de juiste stap is en niet de Google Calendar API.
--
-- Waarom een tabel en geen kolom op profiles: intrekken-en-opnieuw-uitgeven
-- moet een gewone handeling zijn. Lekt de link, of raakt een telefoon kwijt,
-- dan zet je revoked_at en is de oude dood terwijl de historie zichtbaar blijft.
-- Zelfde vorm als group_invites (tables/11), inclusief het patroon "de eigenaar
-- beheert zijn eigen rijen via RLS, het inwisselen loopt buiten die policies om".
--
-- Het token ís het wachtwoord: agenda-clients doen geen OAuth en sturen geen
-- bearer-token, dus er is geen andere afscherming mogelijk. Wat er in de feed
-- terechtkomt is daarom een ontwerpbeslissing en geen implementatiedetail —
-- zie functions/39_calendar_feed.sql.
create table public.calendar_feeds (
  token uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- De speler heeft er hooguit een handvol; de index dient het opzoeken van
-- "mijn lopende link" en het intrekken van alle vorige.
create index calendar_feeds_player_idx
  on public.calendar_feeds (player_id, created_at desc);

alter table public.calendar_feeds enable row level security;
