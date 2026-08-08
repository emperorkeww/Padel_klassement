-- Crashmeldingen uit de browser, bewaard (#1049).
--
-- #733 bouwde de rapportage: een ErrorBoundary op drie niveaus plus listeners
-- op window "error" en unhandledrejection, die alles naar /api/client-error op
-- de Worker sturen. Wat daar gebeurde:
--
--   if (melding) console.error("client-error", melding);
--   return new Response(null, { status: 204 });
--
-- Meer niet. Zichtbaar in een live `wrangler tail`, weg voor wie een uur later
-- kijkt. We hadden foutrapportage gebouwd en de rapporten weggegooid.
--
-- Zelfde patroon als admin_audit_log (#1036): RLS aan, nul policies, grants
-- ingetrokken. De service-role schrijft (via de edge function `client-error`),
-- het paneel leest via `admin-users`. Geen enkel clientpad raakt deze tabel.
create table public.client_errors (
  id bigint generated always as identity primary key,
  -- 'render' (ErrorBoundary), 'window' (event-handler), 'promise'
  -- (unhandledrejection), of 'onbekend' als er iets anders binnenkwam.
  bron text not null,
  boodschap text not null,
  stack text,
  component_stack text,
  -- Welke foutgrens hem ving; alleen gezet bij bron = 'render'.
  scope text,
  -- Een verdwenen chunk is verwacht na een deploy en geen bug (#733). Apart
  -- gemarkeerd zodat je hem uit de echte crashes kunt filteren.
  chunk boolean not null default false,
  pad text,
  -- __BUILD__ uit de bundel: welke release dit was.
  release text,
  -- Niet-herleidbare id om meldingen uit dezelfde tab aan elkaar te knopen.
  sessie text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- BEWUST GEEN user_id, hoewel de issuetekst die kolom voorstelt.
-- errorReport.ts stuurt hem niet, en dat is daar een expliciete keuze:
-- "Bewust géén user-id of e-mail: voor debuggen is 'dezelfde tab' genoeg, en
-- dan hoeft er geen persoonsgegeven de deur uit." Een kolom aanmaken die alleen
-- gevuld kan worden door die keuze terug te draaien, nodigt uit om dat te doen.
-- Wie een gebruiker nodig heeft, heeft een andere vraag te beantwoorden dan
-- "welke route is stuk".

-- De twee vragen die het paneel stelt: "wat is er recent gebeurd" en
-- "hoe vaak komt déze fout voor". Beide beginnen bij created_at.
create index client_errors_tijd_idx on public.client_errors (created_at desc);

-- Groeperen gebeurt op boodschap + scope; dat is de query van het tabblad.
create index client_errors_groep_idx
  on public.client_errors (boodschap, scope, created_at desc);

alter table public.client_errors enable row level security;

-- Nul policies. Met RLS aan en zonder policy ziet niemand iets — ook niet met
-- een geldige JWT. De service-role gaat er per definitie omheen.
revoke all on public.client_errors from anon, authenticated;
-- Lezen en opruimen van het foutenlogboek (#1049).
--
-- Beide service-role-only: client_errors heeft geen enkele grant en is via
-- PostgREST onbereikbaar, dus dit zijn de enige twee deuren.

-- 1. Het tabblad Fouten ------------------------------------------------------
--
-- Gegroepeerd op boodschap + scope en niet als losse rijen. Eén kapotte route
-- levert honderden identieke meldingen op; als lijst is dat onleesbaar en
-- verbergt het de tweede, zeldzamere fout die er misschien echt toe doet.
--
-- Per groep komt er één voorbeeldstack mee (de nieuwste). Dat is genoeg om mee
-- te beginnen, en het scheelt honderden kilobytes over de lijn.
create or replace function public.admin_client_errors(
  p_dagen integer default 7,
  p_limit integer default 100
)
returns table (
  boodschap text,
  scope text,
  bron text,
  chunk boolean,
  aantal bigint,
  sessies bigint,
  eerste timestamptz,
  laatste timestamptz,
  paden text[],
  releases text[],
  voorbeeld_stack text,
  voorbeeld_component_stack text
)
language sql
security definer
set search_path = ''
stable
as $$
  with venster as (
    select *
      from public.client_errors
     where created_at > now() - make_interval(days => greatest(1, least(coalesce(p_dagen, 7), 90)))
  )
  select
    v.boodschap,
    v.scope,
    -- Binnen één groep is de bron in de praktijk constant; min() geeft een
    -- vaste keuze zonder er een tweede groepeerkolom van te maken.
    min(v.bron) as bron,
    bool_or(v.chunk) as chunk,
    count(*) as aantal,
    count(distinct v.sessie) as sessies,
    min(v.created_at) as eerste,
    max(v.created_at) as laatste,
    (array_agg(distinct v.pad) filter (where v.pad is not null))[1:5] as paden,
    (array_agg(distinct v.release) filter (where v.release is not null))[1:5] as releases,
    (array_agg(v.stack order by v.created_at desc)
       filter (where v.stack is not null))[1] as voorbeeld_stack,
    (array_agg(v.component_stack order by v.created_at desc)
       filter (where v.component_stack is not null))[1] as voorbeeld_component_stack
  from venster v
  group by v.boodschap, v.scope
  order by max(v.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke execute on function public.admin_client_errors(integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_client_errors(integer, integer) to service_role;

-- 2. De bewaartermijn --------------------------------------------------------
--
-- Het open punt uit de issuetekst: "Wat is de bovengrens van het foutenlogboek?
-- 30 dagen is een gok. Als één kapotte release duizenden rijen per uur
-- oplevert, is een teller per boodschap zinvoller dan elke rij bewaren."
--
-- Antwoord: allebei de grenzen, want ze vangen verschillende rampen.
--
--   * De dagengrens vangt de langzame groei. Zonder die grens wordt een
--     foutenlogboek na een jaar zelf het probleem.
--   * De rijgrens vangt de snelle. Een renderlus die vijf meldingen per sessie
--     stuurt maal duizend sessies, zit binnen een uur op tienduizenden rijen —
--     ruim binnen de 30 dagen, en dan helpt de eerste grens niet.
--
-- De rijgrens knipt op leeftijd, niet per boodschap: de nieuwste rijen zijn de
-- interessante, en een teller per boodschap zou de zeldzame fout juist als
-- eerste wegsnijden.
create or replace function public.prune_client_errors(
  p_dagen integer default 30,
  p_max_rijen integer default 50000
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oud integer;
  v_teveel integer;
begin
  delete from public.client_errors
   where created_at < now() - make_interval(days => greatest(1, coalesce(p_dagen, 30)));
  get diagnostics v_oud = row_count;

  delete from public.client_errors
   where id in (
     select id from public.client_errors
      order by created_at desc, id desc
      offset greatest(1000, coalesce(p_max_rijen, 50000))
   );
  get diagnostics v_teveel = row_count;

  return v_oud + v_teveel;
end;
$$;

revoke execute on function public.prune_client_errors(integer, integer)
  from public, anon, authenticated;
grant execute on function public.prune_client_errors(integer, integer) to service_role;
