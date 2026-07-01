-- Realtime: publiceer de tabellen waarop de UI live wil bijwerken.
-- RLS blijft gelden op de realtime-stroom (je ontvangt enkel wat je mag zien).
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.group_members;
