-- Wie draagt er nú een bounty, en voor hoeveel (#805)? Eén bron voor het
-- klassement (de 🎯-badge), de matchkaart-banner en de tests, zodat het getal
-- dat een speler ziet hetzelfde is als wat _bounty_deltas straks uitkeert.
--
-- Eén rij per drager-per-reden: een dictator (rating ≥ 1600) draagt zijn bounty
-- overal en heeft group_id null; een Big Daddy draagt hem alleen in matches van
-- díé groep. Dezelfde speler kan dus meerdere rijen hebben — de pool is per
-- speler, niet per rij, en wordt bij een claim ook maar één keer uitgekeerd.
--
-- security_invoker: group_members valt onder RLS, dus je ziet alleen de kroon
-- van je eigen groepen. player_ratings en profiles zijn al clubbreed leesbaar,
-- dus de troon is voor iedereen zichtbaar — precies zoals de troon zelf.
--
-- Staat de bounty uit (bounty_value = 0, #1168), dan levert deze view geen
-- enkele rij op — zie de where onderaan. Dat is bewust het enige punt waarop de
-- UI stilvalt: het klassement, de groepsstand, de banner op de matchkaart en de
-- feed lezen allemaal hiervandaan, dus ze zwijgen samen en komen samen terug
-- zodra de waarde weer boven nul staat. Een drager met een pool van 0
-- aankondigen zou alleen maar een lege belofte zijn.
create view public.active_bounties
with (security_invoker = true) as
with gekwalificeerd as (
  -- Dezelfde rem als _bounty_deltas: gasten tellen niet mee en een rating onder
  -- THIN_GAMES matches is te dun om een kroon aan te hangen.
  select r.player_id, r.rating, p.created_at
  from public.player_ratings r
  join public.profiles p on p.id = r.player_id
  where not p.is_guest and r.games >= 3
),
dragers as (
  select g.player_id, null::uuid as group_id, 'dictator' as reden
  from gekwalificeerd g
  where g.rating >= 1600
  union all
  -- Subquery: een distinct on heeft z'n eigen order by nodig, en die zou
  -- anders bij de union horen.
  select * from (
    select distinct on (gm.group_id)
           gm.player_id, gm.group_id, 'bigdaddy' as reden
    from public.group_members gm
    join gekwalificeerd g on g.player_id = gm.player_id
    order by gm.group_id, g.rating desc, g.created_at asc, g.player_id asc
  ) bd
)
select
  d.player_id,
  d.group_id,
  d.reden,
  s.streak,
  public.bounty_value(s.streak) as pool
from dragers d
cross join lateral (select public.bounty_streak(d.player_id) as streak) s
where public.bounty_value(s.streak) > 0;

grant select on public.active_bounties to authenticated, anon;
