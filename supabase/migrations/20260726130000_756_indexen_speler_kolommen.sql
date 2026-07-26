-- #756 (follow-up op #737): drie tabellen waar player_id wél in de PK zit,
-- maar niet vooraan — en een B-tree kan alleen een prefix bedienen:
--
--   attendance        (group_id, date, player_id)
--   slot_availability (group_id, player_id, date, start_time)
--   play_poll_votes   (option_id, player_id)
--
-- Een lookup op alléén player_id valt dus terug op een seq scan. claim_guest()
-- (schemas/functions/27_guest_claims.sql) doet dat zes keer op rij bij het
-- omhangen van een gastprofiel, en alle drie zijn het bovendien refererende
-- FK-kolommen naar profiles: elke profiel-verwijdering scant ze opnieuw.
--
-- Alleen (player_id), geen dekkende variant zoals bij group_members in #737:
-- daar had de zelf-join in shares_group() group_id uit de index zelf nodig.
-- Hier hangt aan elke treffer een delete of update, dus de heap-rij wordt hoe
-- dan ook aangeraakt en levert een extra kolom niets op.
create index if not exists attendance_player_idx
  on public.attendance (player_id);

create index if not exists slot_availability_player_idx
  on public.slot_availability (player_id);

create index if not exists play_poll_votes_player_idx
  on public.play_poll_votes (player_id);
