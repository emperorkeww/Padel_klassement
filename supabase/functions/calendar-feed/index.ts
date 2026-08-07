// Edge Function: de persoonlijke agenda-feed (#1099).
//
// Eén URL per speler — /functions/v1/calendar-feed/<token>.ics — die
// text/calendar teruggeeft. Je stelt hem één keer in bij Google, Apple of
// Outlook, en vanaf dan haalt je agenda-app zélf op wat er op de planning
// staat. Nieuwe speeldag erbij, verzet moment mee, afgelast weg — zonder dat
// iemand nog iets hoeft te downloaden.
//
// In tegenstelling tot club-page en poll-deadline zit hier bewust GEEN
// cronGuard: een agenda-app kan geen geheim meesturen. Het token in het pad is
// de hele afscherming, en daarom:
//   - strikte UUID-validatie vóór er iets met de database gebeurt;
//   - ongeldig, onbekend én ingetrokken geven alle drie hetzelfde antwoord
//     (404), zodat de respons niets verraadt;
//   - de query loopt via public.calendar_feed_events, een SECURITY DEFINER-
//     functie die alleen dit ene ding kan. Deze function heeft dus genoeg aan
//     de anon-sleutel en raakt de service-role nooit aan.
//
// Alles wat zonder Deno te testen valt staat in ../_shared/feedRoute.ts en
// ../_shared/ics.ts; hier blijft de bedrading over.
//
// Deploy ZONDER JWT-verificatie (supabase/config.toml zet verify_jwt = false):
//   supabase functions deploy calendar-feed --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import { feedVenster } from "../_shared/ics.ts";
import {
  feedRespons,
  nietGevonden,
  tokenUitPad,
  type FeedRij,
} from "../_shared/feedRoute.ts";

const anon = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
);

Deno.serve(async (req) => {
  // HEAD hoort erbij: een deel van de agenda-apps polst zo of er iets
  // veranderde voordat ze de hele feed ophalen.
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const token = tokenUitPad(req.url);
  if (!token) return nietGevonden();

  const { from, to } = feedVenster();
  const { data, error } = await anon.rpc("calendar_feed_events", {
    p_token: token,
    p_from: from,
    p_to: to,
  });

  if (error) {
    return new Response("Bad Gateway", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return feedRespons(data as FeedRij[] | null, { head: req.method === "HEAD" });
});
