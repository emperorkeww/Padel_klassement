// Edge Function: "admin-content" — beheer van de inhoud (#1159).
//
// Tweelingbroer van `admin-users`. Die gaat over accounts; deze over matches,
// groepen en polls. Twee functions en niet één: ze delen alleen de
// toegangsbeslissing (_shared/adminAuth.ts) en het auditfilter
// (_shared/adminAudit.ts), verder niets — admin-users heeft zijn eigen secret
// (ADMIN_SITE_URL) en zijn eigen link-logica, en samen zouden ze één bestand
// van zeshonderd regels zijn.
//
// Waarom álles hierlangs loopt in plaats van via ruimere RLS-policies: zie de
// kop van supabase/schemas/functions/40_admin_inhoud.sql. Kort: een beheerder
// die overal doorheen mag kijken, krijgt anders de matches van alle vreemde
// groepen in zijn eigen dashboard-feed en kwartaalstand. En dit is meteen de
// enige plek waar het auditspoor geschreven kan worden — de service-role is de
// enige rol met een insert-grant op admin_audit_log.
//
// Deploy MÉT JWT-verificatie (de platform-standaard, dus géén entry in
// config.toml), net als admin-users. SUPABASE_URL, SUPABASE_ANON_KEY en
// SUPABASE_SERVICE_ROLE_KEY komen van het platform; eigen secrets zijn er niet.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ADMIN_INHOUD_ACTIES,
  type AdminInhoudActie,
  bepaalToegang,
} from "../_shared/adminAuth.ts";
import { veiligeDetails } from "../_shared/adminAudit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Service-role client: draait de service-role-only RPC's uit
// 40_admin_inhoud.sql én schrijft rechtstreeks op matches/groups/play_polls.
// Die schrijfacties gaan bewust niet via een RPC — het zijn losse updates, en
// de rating-triggers op public.matches vuren ongeacht welke rol ze doet.
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

/** Body van elke aanroep. Alles optioneel; per actie wordt gecontroleerd wat
 *  er écht moet staan. */
type Body = {
  action?: unknown;
  match_id?: unknown;
  group_id?: unknown;
  poll_id?: unknown;
  user_id?: unknown;
  // Filters van de leesacties.
  van?: unknown;
  tot?: unknown;
  zoek?: unknown;
  limiet?: unknown;
  // Waarden van de muterende acties.
  score_a?: unknown;
  score_b?: unknown;
  winner_team_id?: unknown;
  set_scores?: unknown;
  status?: unknown;
  played_at?: unknown;
  naam?: unknown;
};

function tekst(waarde: unknown): string | null {
  return typeof waarde === "string" && waarde !== "" ? waarde : null;
}

/** Een score is een niet-negatief geheel getal. Alles anders is een 400 en
 *  geen stille 0 — een verkeerd getal in de stand vindt niemand meer terug. */
function score(waarde: unknown): number | null {
  if (typeof waarde !== "number" || !Number.isInteger(waarde) || waarde < 0) {
    return null;
  }
  return waarde;
}

const MATCH_STATUSSEN = ["scheduled", "in_progress", "completed", "cancelled"];

function uitslag(a: unknown, b: unknown): string {
  return `${a ?? "?"}-${b ?? "?"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geen geldige payload" }, 400);
  }

  // Wie belt er? De anon-client op de meegestuurde header valideert de JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const uid = userData.user?.id ?? null;

  // Fail-closed: faalt de check, dan geldt "geen beheerder".
  let isAdmin = false;
  if (uid) {
    const { data, error } = await admin.rpc("is_app_admin", { p_uid: uid });
    isAdmin = !error && data === true;
  }

  const toegang = bepaalToegang<AdminInhoudActie>({
    uid,
    isAdmin,
    actie: body.action,
    bekend: ADMIN_INHOUD_ACTIES,
  });
  if (toegang.soort === "weiger") {
    return json({ error: toegang.fout }, toegang.status);
  }

  switch (toegang.actie) {
    case "list_matches": {
      const { data, error } = await admin.rpc("admin_matches_overzicht", {
        p_group: tekst(body.group_id),
        p_van: tekst(body.van),
        p_tot: tekst(body.tot),
        p_status: tekst(body.status),
        p_zoek: tekst(body.zoek),
        p_limit: typeof body.limiet === "number" ? body.limiet : 200,
      });
      if (error) return json({ error: error.message }, 500);
      // `totaal` staat op elke rij (vensterfunctie); apart meesturen zodat het
      // paneel ook bij nul resultaten weet dat het er nul zijn en niet "nog
      // niet geladen".
      const rijen = data ?? [];
      return json({ matches: rijen, totaal: rijen[0]?.totaal ?? 0 });
    }

    case "list_polls": {
      const { data, error } = await admin.rpc("admin_polls_overzicht", {
        p_group: tekst(body.group_id),
        p_limit: typeof body.limiet === "number" ? body.limiet : 200,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ polls: data ?? [] });
    }

    case "list_group_members": {
      const groupId = tekst(body.group_id);
      if (!groupId) return json({ error: "group_id vereist" }, 400);
      const { data, error } = await admin.rpc("admin_groep_leden", {
        p_group: groupId,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ leden: data ?? [] });
    }

    case "audit_recent": {
      const { data, error } = await admin.rpc("admin_audit_recent", {
        p_limit: typeof body.limiet === "number" ? body.limiet : 100,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ regels: data ?? [] });
    }

    default:
      return await voerMutatieUit(toegang.actie, toegang.uid, body);
  }
});

/** Eén match zoals het overzicht hem teruggeeft, of null. */
async function haalMatch(matchId: string) {
  const { data } = await admin.rpc("admin_matches_overzicht", {
    p_match: matchId,
    p_limit: 1,
  });
  return data?.[0] ?? null;
}

/** Eén poll zoals het overzicht hem teruggeeft, of null. */
async function haalPoll(pollId: string) {
  const { data } = await admin.rpc("admin_polls_overzicht", {
    p_poll: pollId,
    p_limit: 1,
  });
  return data?.[0] ?? null;
}

type Auditrij = {
  target_type: "match" | "group" | "poll";
  target_id: string;
  /** Alleen als de actie óók over een persoon gaat (lid verwijderen, eigenaar
   *  aanwijzen) — dan verschijnt ze ook in het tabblad van die gebruiker. */
  target_user_id?: string | null;
  payload: Record<string, unknown>;
};

/**
 * De acties die iets veranderen. Elk pad laat een auditrij achter; slaagt die
 * insert niet, dan geldt de actie als mislukt. Dezelfde regel als in
 * admin-users: ingrijpen in andermans groep zonder spoor is erger dan niet
 * kunnen ingrijpen.
 *
 * Bij de verwijderingen wordt de rij daarom vóóraf geschreven — daarna valt er
 * niets meer op te zoeken.
 */
async function voerMutatieUit(
  actie: AdminInhoudActie,
  actorId: string,
  body: Body,
): Promise<Response> {
  switch (actie) {
    case "update_match_score": {
      const matchId = tekst(body.match_id);
      if (!matchId) return json({ error: "match_id vereist" }, 400);

      const scoreA = score(body.score_a);
      const scoreB = score(body.score_b);
      if (scoreA === null || scoreB === null) {
        return json({ error: "Ongeldige score" }, 400);
      }

      const match = await haalMatch(matchId);
      if (!match) return json({ error: "Match niet gevonden" }, 404);

      // De winnaar moet een van de twee deelnemende teams zijn (of null bij
      // gelijkspel). De tabel bewaakt dit ook (matches_winner_valid), maar een
      // 400 met uitleg is beter dan een constraint-fout uit de diepte.
      const winnaar = tekst(body.winner_team_id);
      if (
        winnaar !== null &&
        winnaar !== match.team_a_id &&
        winnaar !== match.team_b_id
      ) {
        return json({ error: "De winnaar speelt niet in deze match" }, 400);
      }

      const patch: Record<string, unknown> = {
        score_a: scoreA,
        score_b: scoreB,
        winner_team_id: winnaar,
      };

      // set_scores alleen aanraken als het meekomt — precies zoals
      // updateMatchScore() in de client, zodat een correctie zonder set-invoer
      // de bestaande set-stand niet wist. Expliciet null wist hem wél.
      if (body.set_scores !== undefined) {
        if (body.set_scores !== null && !Array.isArray(body.set_scores)) {
          return json({ error: "set_scores moet een lijst zijn" }, 400);
        }
        patch.set_scores = body.set_scores;
      }

      // Een uitslag zetten op een nog niet afgeronde match mag, maar dan moet
      // de status expliciet mee. Impliciet afronden zou een geplande match
      // ongemerkt in de stand duwen.
      const status = tekst(body.status);
      if (status !== null) {
        if (!MATCH_STATUSSEN.includes(status)) {
          return json({ error: "Onbekende status" }, 400);
        }
        patch.status = status;
      }

      const { data, error } = await admin
        .from("matches")
        .update(patch)
        .eq("id", matchId)
        .select("id");
      if (error) return json({ error: error.message }, 500);
      if (!data || data.length === 0) {
        return json({ error: "Match niet gevonden" }, 404);
      }

      return await sluitAf(actie, actorId, { ok: true }, {
        target_type: "match",
        target_id: matchId,
        payload: {
          groep: match.groep_naam,
          oude_uitslag: uitslag(match.score_a, match.score_b),
          nieuwe_uitslag: uitslag(scoreA, scoreB),
        },
      });
    }

    case "move_match": {
      const matchId = tekst(body.match_id);
      if (!matchId) return json({ error: "match_id vereist" }, 400);

      // Expliciet aanwezig moeten zijn: een ontbrekend veld mag geen "wis het
      // tijdstip" worden. Null is een geldige waarde (match zonder moment).
      if (body.played_at === undefined) {
        return json({ error: "played_at vereist" }, 400);
      }
      const nieuw = body.played_at === null ? null : tekst(body.played_at);
      if (nieuw !== null && Number.isNaN(Date.parse(nieuw))) {
        return json({ error: "Ongeldig tijdstip" }, 400);
      }

      const match = await haalMatch(matchId);
      if (!match) return json({ error: "Match niet gevonden" }, 404);

      const { error } = await admin
        .from("matches")
        .update({ played_at: nieuw })
        .eq("id", matchId);
      if (error) return json({ error: error.message }, 500);

      return await sluitAf(actie, actorId, { ok: true }, {
        target_type: "match",
        target_id: matchId,
        payload: {
          groep: match.groep_naam,
          oud_moment: match.played_at,
          nieuw_moment: nieuw,
        },
      });
    }

    case "delete_match": {
      const matchId = tekst(body.match_id);
      if (!matchId) return json({ error: "match_id vereist" }, 400);

      const match = await haalMatch(matchId);
      if (!match) return json({ error: "Match niet gevonden" }, 404);

      // Alles wat straks niet meer op te zoeken is, nú vastleggen.
      const rij: Auditrij = {
        target_type: "match",
        target_id: matchId,
        payload: {
          groep: match.groep_naam,
          status: match.status,
          uitslag: uitslag(match.score_a, match.score_b),
          spelers: [
            (match.team_a_spelers ?? []).join(" & "),
            (match.team_b_spelers ?? []).join(" & "),
          ].join(" vs "),
        },
      };
      const vooraf = await schrijfAudit(actie, actorId, rij);
      if (vooraf) {
        return json({ error: "Auditspoor mislukte, er is niets verwijderd" }, 500);
      }

      // rating_history hangt met on delete cascade aan de match en de
      // rating-triggers herberekenen; zie de kop van 16_delete_match.sql. Ook
      // een afgeronde match mag dus weg — dat is precies waarvoor deze knop
      // bestaat, en de client staat het niemand anders toe.
      const { error } = await admin.from("matches").delete().eq("id", matchId);
      if (error) return json({ error: `Verwijderen mislukte: ${error.message}` }, 500);
      return json({ ok: true });
    }

    case "set_poll_status": {
      const pollId = tekst(body.poll_id);
      if (!pollId) return json({ error: "poll_id vereist" }, 400);

      // Alleen annuleren en heropenen. Vastleggen ("locked") vraagt om een
      // gekozen moment en is een groepsbeslissing, geen beheerdaad.
      const status = tekst(body.status);
      if (status !== "open" && status !== "cancelled") {
        return json({ error: "Alleen open of cancelled" }, 400);
      }

      const poll = await haalPoll(pollId);
      if (!poll) return json({ error: "Poll niet gevonden" }, 404);

      // Heropenen wist de boeking, net als reopenPoll() in de client: een oude
      // clubcode of baannummer op een poll die weer open staat, klopt niet meer.
      const patch =
        status === "open"
          ? {
              status,
              locked_option_id: null,
              locked_at: null,
              booked_at: null,
              access_code: null,
              courts: null,
            }
          : { status };

      const { error } = await admin
        .from("play_polls")
        .update(patch)
        .eq("id", pollId);
      if (error) return json({ error: error.message }, 500);

      return await sluitAf(actie, actorId, { ok: true }, {
        target_type: "poll",
        target_id: pollId,
        payload: {
          groep: poll.groep_naam,
          moment: poll.vastgelegd_op,
          oude_status: poll.status,
          nieuwe_status: status,
        },
      });
    }

    case "delete_poll": {
      const pollId = tekst(body.poll_id);
      if (!pollId) return json({ error: "poll_id vereist" }, 400);

      const poll = await haalPoll(pollId);
      if (!poll) return json({ error: "Poll niet gevonden" }, 404);

      const vooraf = await schrijfAudit(actie, actorId, {
        target_type: "poll",
        target_id: pollId,
        payload: {
          groep: poll.groep_naam,
          moment: poll.vastgelegd_op,
          status: poll.status,
          stemmen: poll.aantal_stemmen,
        },
      });
      if (vooraf) {
        return json({ error: "Auditspoor mislukte, er is niets verwijderd" }, 500);
      }

      // Opties en stemmen hangen er met on delete cascade aan.
      const { error } = await admin.from("play_polls").delete().eq("id", pollId);
      if (error) return json({ error: `Verwijderen mislukte: ${error.message}` }, 500);
      return json({ ok: true });
    }

    case "set_group_owner": {
      const groupId = tekst(body.group_id);
      const userId = tekst(body.user_id);
      if (!groupId || !userId) {
        return json({ error: "group_id en user_id vereist" }, 400);
      }

      // De RPC bewaakt de regels (lid, geen gast) en zet beide plekken in één
      // transactie; zie 40_admin_inhoud.sql.
      const { data, error } = await admin.rpc("admin_set_group_owner", {
        p_group: groupId,
        p_uid: userId,
      });
      // 400 en geen 500: elke exception uit die RPC is een afgewezen aanvraag
      // ("geen lid van deze groep", "een gast kan geen eigenaar worden"), en de
      // melding is Nederlands en toonbaar.
      if (error) return json({ error: error.message }, 400);
      const uit = data?.[0] ?? null;

      return await sluitAf(actie, actorId, { ok: true, overdracht: uit }, {
        target_type: "group",
        target_id: groupId,
        target_user_id: userId,
        payload: {
          groep: uit?.groep,
          oude_eigenaar: uit?.oude_eigenaar,
          nieuwe_eigenaar: uit?.nieuwe_eigenaar,
        },
      });
    }

    case "remove_group_member": {
      const groupId = tekst(body.group_id);
      const userId = tekst(body.user_id);
      if (!groupId || !userId) {
        return json({ error: "group_id en user_id vereist" }, 400);
      }

      const { data: groep } = await admin
        .from("groups")
        .select("name, created_by")
        .eq("id", groupId)
        .maybeSingle();
      if (!groep) return json({ error: "Groep niet gevonden" }, 404);

      // De eigenaar eruit zetten zou een groep achterlaten waarvan de eigenaar
      // geen lid meer is: hij houdt dan al zijn rechten (die hangen aan
      // groups.created_by) maar staat nergens meer in de ledenlijst. Eerst
      // overdragen, dan pas verwijderen.
      if (groep.created_by === userId) {
        return json(
          { error: "Wijs eerst een andere eigenaar aan voor deze groep" },
          400,
        );
      }

      const { data: profiel } = await admin
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();

      const { data, error } = await admin
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("player_id", userId)
        .select("player_id");
      if (error) return json({ error: error.message }, 500);
      if (!data || data.length === 0) {
        return json({ error: "Die speler is geen lid van deze groep" }, 404);
      }

      return await sluitAf(actie, actorId, { ok: true }, {
        target_type: "group",
        target_id: groupId,
        target_user_id: userId,
        payload: { groep: groep.name, lid: profiel?.username },
      });
    }

    case "delete_group": {
      const groupId = tekst(body.group_id);
      if (!groupId) return json({ error: "group_id vereist" }, 400);

      const { data: groep } = await admin
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .maybeSingle();
      if (!groep) return json({ error: "Groep niet gevonden" }, 404);

      // De ingetikte naam moet kloppen, zoals delete_user de username eist. De
      // dialoog vraagt er ook om, maar dát is ergonomie; dit is de grendel.
      if (body.naam !== groep.name) {
        return json({ error: "Bevestiging klopt niet" }, 400);
      }

      const [{ count: leden }, { count: matches }, { count: polls }] =
        await Promise.all([
          admin
            .from("group_members")
            .select("player_id", { count: "exact", head: true })
            .eq("group_id", groupId),
          admin
            .from("matches")
            .select("id", { count: "exact", head: true })
            .eq("group_id", groupId),
          admin
            .from("play_polls")
            .select("id", { count: "exact", head: true })
            .eq("group_id", groupId),
        ]);

      const vooraf = await schrijfAudit(actie, actorId, {
        target_type: "group",
        target_id: groupId,
        payload: {
          groep: groep.name,
          leden: leden ?? 0,
          matches: matches ?? 0,
          polls: polls ?? 0,
        },
      });
      if (vooraf) {
        return json({ error: "Auditspoor mislukte, er is niets verwijderd" }, 500);
      }

      // Leden, polls en uitnodigingen cascaderen mee. De matches niet:
      // matches.group_id is `on delete set null`, dus die blijven bestaan als
      // groeploze matches en hun uitslagen blijven in het klassement staan.
      const { error } = await admin.from("groups").delete().eq("id", groupId);
      if (error) return json({ error: `Verwijderen mislukte: ${error.message}` }, 500);
      return json({ ok: true, matches_losgekoppeld: matches ?? 0 });
    }

    default:
      return json({ error: "Onbekende actie" }, 400);
  }
}

/** Schrijft de auditrij; geeft de foutmelding terug, of null bij succes. */
async function schrijfAudit(
  actie: AdminInhoudActie,
  actorId: string,
  rij: Auditrij,
): Promise<string | null> {
  const { error } = await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    action: actie,
    target_user_id: rij.target_user_id ?? null,
    target_type: rij.target_type,
    target_id: rij.target_id,
    details: veiligeDetails(actie, rij.payload),
  });
  return error?.message ?? null;
}

/** Logt de gelukte actie en antwoordt. Mislukt het logboek, dan is dat geen
 *  detail: de actie is al gebeurd, dus dat moet opvallen. */
async function sluitAf(
  actie: AdminInhoudActie,
  actorId: string,
  antwoord: Record<string, unknown>,
  rij: Auditrij,
): Promise<Response> {
  const fout = await schrijfAudit(actie, actorId, rij);
  if (fout) {
    return json({ error: "Actie uitgevoerd, maar het auditspoor mislukte" }, 500);
  }
  return json(antwoord);
}
