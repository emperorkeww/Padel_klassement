-- Uitgelichte badges: de door de speler zelf gekozen badges die bovenaan zijn
-- profiel verschijnen. Een geordende lijst van badge-id's (bv.
-- 'eerste-overwinning'); leeg = niets uitgelicht. Publiek leesbaar zoals de
-- rest van het profiel, en enkel door de eigenaar te wijzigen (de bestaande
-- update-policy op public.profiles dekt dit al).
alter table public.profiles
  add column featured_badges text[] not null default '{}';
