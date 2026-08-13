-- #1271 Aanwezigheid is van de groep, niet van je browser — spiegel van
-- supabase/schemas/tables/13_play_polls.sql, .../policies/play_polls.sql en
-- .../functions/01_group_helpers.sql; zie die bestanden voor de motivatie.
--
-- Wie er meespeelt stond in localStorage (`aanwezigOpslag.ts`). Gevolgen:
--   * een tweede organisator zag jouw correcties niet;
--   * de speler die afzegde zag zichzelf gewoon in de opstelling staan;
--   * een apparaatwissel wiste de hele avond;
--   * en ná het vastleggen kon niemand zich nog afmelden, want stemmen kan
--     alleen zolang de poll open is.
--
-- Bewaard worden de *afwijkingen* van de stemming, niet de hele lijst: wie je
-- niet aanraakte volgt de poll, zodat een late ja-stem nog doorkomt.
--
-- Met de hand geschreven en niet via `supabase db diff`: dat commando draait op
-- develop niet meer door bestaande schema-drift (zie de kop van
-- 20260805120000_1036_adminpaneel.sql).

-- 1. Wie mag deze speeldag beheren ------------------------------------------
--
-- Dezelfde kring die het moment vastlegt. SECURITY DEFINER, want anders zou de
-- policy hieronder langs de RLS van play_polls en play_poll_options moeten —
-- precies de recursie waarvoor is_group_member/is_group_owner al bestaan.
create or replace function public._mag_speeldag_beheren(p_option_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.play_poll_options o
    join public.play_polls p on p.id = o.poll_id
    where o.id = p_option_id
      and (
        p.created_by = (select auth.uid())
        or public.is_group_owner(p.group_id, (select auth.uid()))
      )
  );
$$;

-- 2. De tabel ----------------------------------------------------------------
--
-- Aan de optie en niet aan de poll: een dag kan twee speeldagen dragen (#1146),
-- en een correctie op de ochtendsessie hoort de avond niet te raken.
create table if not exists public.play_poll_presence (
  option_id uuid not null references public.play_poll_options (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  aanwezig boolean not null,
  updated_at timestamptz not null default now(),
  primary key (option_id, player_id)
);

-- Zelfde reden als bij de stemmen: claim_guest() hangt alle rijen van één
-- speler om, en dat kan niet op de PK (option_id staat vooraan).
create index if not exists play_poll_presence_player_idx
  on public.play_poll_presence (player_id);

alter table public.play_poll_presence enable row level security;

-- Expliciet, niet op de default privileges vertrouwen: op sommige omgevingen
-- ontbreken die en levert elke query stil een 403 op.
grant select, insert, update, delete on public.play_poll_presence to authenticated;

-- 3. Policies ----------------------------------------------------------------
--
-- Zichtbaar voor leden. Schrijven mag over jezelf — dat is het afmelden dat na
-- het vastleggen nergens meer kon — en de organisator mag het over iedereen,
-- want dat is precies de correctie die hij op de speeldagpagina maakt.
create policy "play_poll_presence_select_member" on public.play_poll_presence
  for select
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "play_poll_presence_insert" on public.play_poll_presence
  for insert
  with check (
    public.is_group_member(group_id, player_id)
    and exists (
      select 1 from public.play_poll_options o
      where o.id = option_id
        and o.group_id = play_poll_presence.group_id
    )
    and (
      (
        player_id = (select auth.uid())
        and public.is_group_member(group_id, (select auth.uid()))
      )
      or public._mag_speeldag_beheren(option_id)
    )
  );

create policy "play_poll_presence_update" on public.play_poll_presence
  for update
  using (
    player_id = (select auth.uid())
    or public._mag_speeldag_beheren(option_id)
  )
  with check (
    player_id = (select auth.uid())
    or public._mag_speeldag_beheren(option_id)
  );

create policy "play_poll_presence_delete" on public.play_poll_presence
  for delete
  using (
    player_id = (select auth.uid())
    or public._mag_speeldag_beheren(option_id)
  );

-- 4. Realtime ----------------------------------------------------------------
--
-- Een afmelding tijdens de avond hoort bij iedereen te landen, niet pas na een
-- refresh — de indeling die eruit rolt hangt ervan af.
alter publication supabase_realtime add table public.play_poll_presence;
