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
