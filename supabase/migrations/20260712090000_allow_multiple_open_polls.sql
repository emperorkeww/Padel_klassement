-- #267: meerdere speeldag-polls tegelijk per groep toestaan. De partial unique
-- index dwong "één open poll per groep" af; dat blokkeerde meerdere speeldagen
-- in dezelfde week. Vervangen door een gewone group_id-index voor de per-groep
-- queries en de realtime-filter.
drop index if exists public.play_polls_one_open;

create index if not exists play_polls_group on public.play_polls (group_id);
