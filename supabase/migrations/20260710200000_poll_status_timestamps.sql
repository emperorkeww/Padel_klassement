-- Feed v2 (#143): het vastleggen en boeken van een speeldag-poll zijn de
-- sterkste plansignalen, maar hadden geen tijdstip — alleen created_at.
-- Twee timestamps zodat de feed "ligt vast"/"geboekt" kan dateren; de client
-- schrijft ze in lockPoll/markPollBooked en wist ze bij reopenPoll.
alter table public.play_polls
  add column if not exists locked_at timestamptz,
  add column if not exists booked_at timestamptz;
