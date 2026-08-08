-- Herberekenen en exporteren vanuit het beheerpaneel (#1049).

-- 1. De hele klassementketen opnieuw laten lopen -----------------------------
--
-- De vijf recompute_*-functies zijn `security definer` met een `revoke execute
-- … from public` en tot #1049 zónder enkele grant, ook niet aan service_role.
-- Ze draaiden uitsluitend via de triggers op `matches`, of als `postgres` in de
-- SQL-editor. Na een correctie met de hand was de enige manier om de keten
-- opnieuw te laten lopen een dummy-update op `matches` — en die vuurt óók
-- notify_send_push() af, want daar hangen push_on_match_update-triggers aan.
--
-- De grants zelf staan naast elke functiedefinitie (schemas/functions/09, 20,
-- 21) en voor rank_state en dictator_termijnen in de migratie: die twee bestaan
-- alleen in supabase/migrations/ en niet in schemas/ — de bekende drift van
-- #825, die hier bewust niet opgelost wordt.
--
-- De volgorde hieronder is niet willekeurig: hij volgt de triggers op `matches`.
-- Ratings is een row-trigger en gaat voorop; de vier statement-triggers vuren
-- daarna in alfabetische volgorde van hun triggernaam (matches_refresh_pias,
-- matches_refresh_rank_state, matches_troon_termijnen, matches_zwarte_piet).
-- Wie die volgorde hier omgooit, krijgt een klassement dat subtiel afwijkt van
-- wat een gewone matchwijziging zou opleveren.
create or replace function public.admin_herbereken(p_wat text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz := clock_timestamp();
begin
  case p_wat
    when 'ratings' then perform public.recompute_ratings();
    when 'pias' then perform public.recompute_pias();
    when 'rank_state' then perform public.recompute_rank_state();
    when 'dictator' then perform public.recompute_dictator_termijnen();
    when 'zwarte_piet' then perform public.recompute_zwarte_piet();
    else raise exception 'Onbekende herberekening: %', p_wat;
  end case;

  return jsonb_build_object(
    'wat', p_wat,
    'duur_ms', round(extract(milliseconds from clock_timestamp() - v_start))
  );
end;
$$;

revoke execute on function public.admin_herbereken(text) from public, anon, authenticated;
grant execute on function public.admin_herbereken(text) to service_role;

-- 2. De gegevensexport van iemand anders --------------------------------------
--
-- Zelfbediening bestaat al: exporteerMijnGegevens() in src/features/account/api.ts
-- stelt hem client-side samen uit de gewone api-functies, en leunt daarmee
-- bewust op RLS — die bepaalt al precies wat jij mag zien. Precies daarom kan
-- een beheerder hem niet vóór een ander draaien, en dat is nou net het geval
-- waarin je hem nodig hebt: iemand die er niet meer in komt.
--
-- Dus een serverzijdige tegenhanger. Die formuleert de regels niet opnieuw —
-- hij negeert ze, als service_role, voor precies één opgegeven persoon.
--
-- LET OP de volgorde in de praktijk: ná delete_user is dit onmogelijk, want de
-- cascades hebben de rijen dan opgeruimd. Het paneel biedt de export daarom aan
-- ín de verwijderbevestiging.
create or replace function public.admin_export_user(p_uid uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'geexporteerd_op', now(),
    'gebruiker_id', p_uid,
    'profiel', (
      select to_jsonb(p) from public.profiles p where p.id = p_uid
    ),
    'groepen', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'groep', g.name, 'rol', gm.role, 'lid_sinds', gm.joined_at
             ) order by gm.joined_at), '[]'::jsonb)
        from public.group_members gm
        join public.groups g on g.id = gm.group_id
       where gm.player_id = p_uid
    ),
    'matches', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', m.id, 'gespeeld_op', m.played_at, 'status', m.status,
               'score_a', m.score_a, 'score_b', m.score_b,
               'groep', g.name
             ) order by m.played_at desc nulls last), '[]'::jsonb)
        from public.matches m
        left join public.groups g on g.id = m.group_id
       where exists (
         select 1 from public.teams t
          where t.id in (m.team_a_id, m.team_b_id)
            and p_uid in (t.player1_id, t.player2_id)
       )
    ),
    'vriendschappen', (
      select coalesce(jsonb_agg(jsonb_build_object(
               -- De ánder in de vriendschap, ongeacht wie hem aanvroeg.
               'met', case when f.requester_id = p_uid
                           then ontvanger.username else aanvrager.username end,
               'status', f.status,
               'aangevraagd_door_mij', f.requester_id = p_uid
             ) order by f.created_at), '[]'::jsonb)
        from public.friendships f
        left join public.profiles aanvrager on aanvrager.id = f.requester_id
        left join public.profiles ontvanger on ontvanger.id = f.addressee_id
       where f.requester_id = p_uid or f.addressee_id = p_uid
    ),
    'meldingen', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'soort', n.soort, 'titel', n.title, 'tekst', n.body,
               'gelezen', n.read_at is not null, 'op', n.created_at
             ) order by n.created_at desc), '[]'::jsonb)
        from public.notifications n
       where n.user_id = p_uid
    ),
    'gasten', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'username', gp.username, 'aangemaakt_op', gp.created_at
             ) order by gp.created_at), '[]'::jsonb)
        from public.profiles gp
       where gp.owner_id = p_uid and gp.is_guest
    )
  );
$$;

revoke execute on function public.admin_export_user(uuid) from public, anon, authenticated;
grant execute on function public.admin_export_user(uuid) to service_role;
