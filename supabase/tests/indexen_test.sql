-- pgTAP-tests voor de indexen uit #737 en #756. Deze test bewaakt twee dingen:
-- dat de indexen bestaan én dat migratie en declaratief schema
-- (supabase/schemas/tables/) niet uit elkaar lopen -- zie #698. has_index()
-- kijkt naar de werkelijke kolommen, dus een index die per ongeluk op de
-- verkeerde kolom belandt valt hier door de mand.
begin;

select plan(7);

select has_index('public', 'teams', 'teams_player1_idx', 'player1_id',
  'teams heeft een index op player1_id (#737)');

select has_index('public', 'teams', 'teams_player2_idx', 'player2_id',
  'teams heeft een index op player2_id (#737)');

-- (player_id, group_id): de tweede kolom maakt de zelf-join in shares_group()
-- een index-only scan. Wordt die weggehaald, dan faalt deze assertie.
select has_index('public', 'group_members', 'group_members_player_idx',
  array['player_id', 'group_id'],
  'group_members heeft een dekkende index op (player_id, group_id) (#737)');

-- De PK blijft leidend voor is_group_member(group_id, uid), dat in vrijwel elke
-- RLS-policy zit. Hier geborgd zodat een latere herschikking van de PK opvalt.
select col_is_pk('public', 'group_members', array['group_id', 'player_id'],
  'group_members houdt de PK (group_id, player_id)');

-- #756: player_id zit in deze drie PK's, maar niet vooraan. claim_guest() hangt
-- ze alle drie om op player_id alleen; zonder deze indexen is dat een seq scan.
select has_index('public', 'attendance', 'attendance_player_idx', 'player_id',
  'attendance heeft een index op player_id (#756)');

select has_index('public', 'slot_availability', 'slot_availability_player_idx',
  'player_id',
  'slot_availability heeft een index op player_id (#756)');

select has_index('public', 'play_poll_votes', 'play_poll_votes_player_idx',
  'player_id',
  'play_poll_votes heeft een index op player_id (#756)');

select * from finish();

rollback;
