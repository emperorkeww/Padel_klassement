-- #413: deelnemers kunnen de uitslag van hun eigen (gegenereerde) match niet
-- invullen omdat de enige UPDATE-policy op matches alleen created_by toestaat.
-- Nieuwe helper + tweede permissive policy: spelers in team A of B mogen de
-- overgang naar 'completed' maken zolang de match nog niet afgerond is.
-- Corrigeren achteraf en het tijdstip wijzigen blijven bij de aanmaker.

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.teams t
    where t.id = p_team_id
      and p_uid in (t.player1_id, t.player2_id)
  );
$function$
;

create policy "Deelnemer kan uitslag invullen"
  on "public"."matches"
  as permissive
  for update
  to authenticated
using (((status <> 'completed'::public.match_status) AND (public.is_team_member(team_a_id, ( SELECT auth.uid() AS uid)) OR public.is_team_member(team_b_id, ( SELECT auth.uid() AS uid)))))
with check (((status = 'completed'::public.match_status) AND (public.is_team_member(team_a_id, ( SELECT auth.uid() AS uid)) OR public.is_team_member(team_b_id, ( SELECT auth.uid() AS uid)))));
