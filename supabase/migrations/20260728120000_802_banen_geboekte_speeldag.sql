-- Banen van de boeking (#802): welke baan/banen gereserveerd zijn. Spiegel van

-- access_code (#675) — zelfde vrije tekst, zelfde lengte, ook ná het boeken nog
-- te zetten, en alleen zichtbaar voor groepsleden (play_polls_select_member).
alter table public.play_polls
  add column courts text check (courts is null or length(courts) <= 60);
