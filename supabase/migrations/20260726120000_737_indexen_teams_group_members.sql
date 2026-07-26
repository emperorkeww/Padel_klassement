-- #737: teams en group_members groeien monotoon mee met het aantal
-- spelersparen en lidmaatschappen, en worden op de warmste paden op één
-- spelerskolom bevraagd. Geen van de bestaande indexen dekt dat:
--
--   * teams_unique_pair staat op (least(p1, p2), greatest(p1, p2)) en helpt
--     alleen bij het opzoeken van een compleet paar, niet bij een zoektocht op
--     één speler -- wat getPlayerMatches(), replace_match_player() en
--     claim_guest() nu juist doen.
--   * de group_members-PK (group_id, player_id) dekt is_group_member() prima,
--     maar een lookup op alleen player_id kan er niet op. Dat pad loopt via
--     shares_group(), dat per rij wordt aangeroepen vanuit de
--     friendships-select-policy.
--
-- Alle drie zijn bovendien refererende FK-kolommen naar profiles: zonder index
-- kost elke profiel-verwijdering drie sequentiële scans.
create index if not exists teams_player1_idx on public.teams (player1_id);
create index if not exists teams_player2_idx on public.teams (player2_id);

-- (player_id, group_id) i.p.v. alleen player_id: de zelf-join in
-- shares_group() heeft group_id van beide kanten nodig en wordt zo een
-- index-only scan. De extra kolom kost een handvol bytes per rij.
create index if not exists group_members_player_idx
  on public.group_members (player_id, group_id);
