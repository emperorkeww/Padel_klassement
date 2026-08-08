// Edge Function: "admin-users" — de enige weg naar de beheeracties (#1036).
//
// Alle adminacties lopen hierlangs en nooit via de browser: de service-role key
// hoort niet in clientcode en niet in een VITE_-variabele. De client roept aan
// met supabase.functions.invoke("admin-users", { body: { action, ... } }),
// waarbij de Authorization-header van de gebruiker automatisch meegaat.
//
// Deploy MÉT JWT-verificatie (de platform-standaard, dus géén entry in
// config.toml) — net als remind-group. Dat is een extra laag bóvenop de
// is_app_admin-check hieronder; de issuetekst stelde verify_jwt = false voor,
// maar er is geen reden om de gratis gate weg te gooien voor een function die
// altijd namens een ingelogde gebruiker wordt aangeroepen.
//
// SUPABASE_URL, SUPABASE_ANON_KEY en SUPABASE_SERVICE_ROLE_KEY worden door het
// platform meegegeven; er zijn geen eigen secrets nodig.

import { createClient } from "npm:@supabase/supabase-js@2";
import { bepaalToegang, type AdminActie } from "../_shared/adminAuth.ts";
import { veiligeDetails } from "../_shared/adminAudit.ts";
import { alleSecrets, EDGE_FUNCTIES } from "../_shared/edgeFuncties.ts";
import { beoordeelCron, type CronJobFeiten } from "../_shared/cronGezondheid.ts";
import { genereerWachtwoord } from "../_shared/adminWachtwoord.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Basis voor de herstel-link. Komt uit een secret en NOOIT uit de request-body:
// een door de aanroeper meegegeven basis maakt hiervan een open redirect die
// een geldig hersteltoken naar een vreemde host stuurt. Lokaal valt hij terug
// op de dev-server.
const SITE_URL = (Deno.env.get("ADMIN_SITE_URL") ?? "http://localhost:5173")
  .replace(/\/+$/, "");

// Supabase's otp_expiry staat op een uur (config.toml). Meesturen zodat de
// beheerder weet wat hij aan de telefoon belooft.
const OTP_GELDIG_MINUTEN = 60;

// Service-role client: draait de RPC's die auth.users lezen. Die zijn service-
// role-only (zie schemas/functions/37_app_admin.sql), dus dit is de enige
// client die ze überhaupt kan aanroepen.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: {
    action?: unknown;
    user_id?: unknown;
    email?: unknown;
    username?: unknown;
    /** Venster van het foutenlogboek in dagen (#1049). */
    dagen?: unknown;
    /** Schakelaars (#1049). */
    sleutel?: unknown;
    aan?: unknown;
    dagbudget?: unknown;
    /** Welk onderdeel herberekend moet worden (#1049). */
    wat?: unknown;
  };
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

  // Is die persoon beheerder? Met de service-role client, want is_app_admin is
  // voor authenticated niet uitvoerbaar. Faalt de RPC, dan geldt "geen
  // beheerder" — fail-closed, een storing mag geen deur openzetten.
  let isAdmin = false;
  if (uid) {
    const { data, error } = await admin.rpc("is_app_admin", { p_uid: uid });
    isAdmin = !error && data === true;
  }

  const toegang = bepaalToegang({ uid, isAdmin, actie: body.action });
  if (toegang.soort === "weiger") {
    return json({ error: toegang.fout }, toegang.status);
  }

  switch (toegang.actie) {
    case "whoami":
      return json({ admin: isAdmin });

    case "list_users": {
      const { data, error } = await admin.rpc("admin_users_overzicht");
      if (error) return json({ error: error.message }, 500);
      return json({ users: data ?? [] });
    }

    case "user_detail": {
      const targetId = body.user_id;
      if (typeof targetId !== "string" || targetId === "") {
        return json({ error: "user_id vereist" }, 400);
      }
      const { data, error } = await admin.rpc("admin_user_detail", {
        p_uid: targetId,
      });
      if (error) return json({ error: error.message }, 500);
      // De RPC geeft null terug als het profiel niet bestaat.
      if (data === null) return json({ error: "Gebruiker niet gevonden" }, 404);
      return json({ detail: data });
    }

    case "list_guests": {
      const { data, error } = await admin.rpc("admin_gasten_overzicht");
      if (error) return json({ error: error.message }, 500);
      return json({ gasten: data ?? [] });
    }

    case "list_groups": {
      const { data, error } = await admin.rpc("admin_groepen_overzicht");
      if (error) return json({ error: error.message }, 500);
      return json({ groepen: data ?? [] });
    }

    case "audit_log": {
      const targetId = body.user_id;
      if (typeof targetId !== "string" || targetId === "") {
        return json({ error: "user_id vereist" }, 400);
      }
      const { data, error } = await admin.rpc("admin_audit_voor", {
        p_uid: targetId,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ regels: data ?? [] });
    }

    // ---- Systeemgezondheid (#1049) -----------------------------------------
    //
    // Drie bronnen in één antwoord. De databankkant komt uit de RPC; de
    // secrets kan alléén een edge function beantwoorden, want die env is
    // projectbreed en nergens anders zichtbaar. Er gaat uitsluitend "gezet
    // ja/nee" over de lijn — nooit een waarde, ook niet afgekapt.
    case "system_status": {
      const { data, error } = await admin.rpc("admin_systeem_status");
      if (error) return json({ error: error.message }, 500);

      const gezet = (naam: string): boolean => {
        const v = Deno.env.get(naam);
        return v !== undefined && v !== "";
      };

      // Het oordeel valt hier en niet in de client: cronGezondheid.ts is één
      // getoetste implementatie, en de klok van de server is betrouwbaarder dan
      // die van de browser die het paneel toevallig openslaat.
      const nu = new Date();
      const databank = data as Record<string, unknown> | null;
      const jobs = Array.isArray(databank?.cron)
        ? (databank.cron as CronJobFeiten[]).map((j) => ({
            ...j,
            oordeel: beoordeelCron(j, nu),
          }))
        : null;

      return json({
        databank: { ...databank, cron: jobs },
        secrets: Object.fromEntries(alleSecrets().map((s) => [s, gezet(s)])),
        functies: EDGE_FUNCTIES.map((f) => ({
          naam: f.naam,
          rol: f.rol,
          verifyJwt: f.verifyJwt,
          cronGeheim: f.cronGeheim,
          ontbrekend: f.vereist.filter((s) => !gezet(s)),
        })),
      });
    }

    // ---- Foutenlogboek (#1049) ---------------------------------------------
    case "client_errors": {
      const dagen = typeof body.dagen === "number" ? body.dagen : 7;
      const { data, error } = await admin.rpc("admin_client_errors", {
        p_dagen: dagen,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ groepen: data ?? [] });
    }

    // ---- Schakelaars zonder deploy (#1049) ----------------------------------
    case "list_settings": {
      const { data, error } = await admin.rpc("admin_app_settings");
      if (error) return json({ error: error.message }, 500);
      return json({ instellingen: data ?? [] });
    }

    // Muterend, maar niet via voerMutatieUit: die functie is gebouwd rond een
    // doelgebruiker (`user_id` verplicht) en een schakelaar heeft er geen.
    // Vandaar hier, mét dezelfde auditregel: mislukt het spoor, dan is de actie
    // mislukt.
    case "set_setting": {
      const sleutel = body.sleutel;
      const aan = body.aan;
      if (typeof sleutel !== "string" || sleutel === "") {
        return json({ error: "sleutel vereist" }, 400);
      }
      if (typeof aan !== "boolean") {
        return json({ error: "aan moet true of false zijn" }, 400);
      }
      const dagbudget =
        typeof body.dagbudget === "number" && Number.isFinite(body.dagbudget)
          ? Math.round(body.dagbudget)
          : null;

      const { data, error } = await admin.rpc("admin_zet_app_setting", {
        p_sleutel: sleutel,
        p_aan: aan,
        p_actor: toegang.uid,
        p_dagbudget: dagbudget,
      });
      if (error) return json({ error: error.message }, 500);

      const heen = data as { oud?: Record<string, unknown> } | null;
      const { error: auditFout } = await admin.from("admin_audit_log").insert({
        actor_id: toegang.uid,
        action: "set_setting",
        details: veiligeDetails("set_setting", {
          sleutel,
          van: heen?.oud?.aan === false ? "uit" : "aan",
          naar: aan ? "aan" : "uit",
          dagbudget,
        }),
      });
      if (auditFout) {
        return json(
          { error: "Schakelaar omgezet, maar het auditspoor mislukte" },
          500,
        );
      }
      return json({ ok: true });
    }

    // ---- Herberekenen (#1049) -----------------------------------------------
    //
    // Net als set_setting buiten voerMutatieUit: er is geen doelgebruiker.
    //
    // Eén onderdeel per aanroep, bewust niet alle vijf achter elkaar: vijf
    // volledige herberekeningen in één HTTP-verzoek lopen tegen de tijdslimiet
    // van de edge function aan. De client roept ze op volgorde aan en houdt de
    // beheerder op de hoogte; elke stap krijgt zijn eigen auditrij.
    case "recompute": {
      const wat = body.wat;
      if (typeof wat !== "string" || wat === "") {
        return json({ error: "wat vereist" }, 400);
      }
      const { data, error } = await admin.rpc("admin_herbereken", {
        p_wat: wat,
      });
      if (error) return json({ error: error.message }, 500);

      const uitkomst = (data ?? {}) as Record<string, unknown>;
      const { error: auditFout } = await admin.from("admin_audit_log").insert({
        actor_id: toegang.uid,
        action: "recompute",
        details: veiligeDetails("recompute", uitkomst),
      });
      if (auditFout) {
        return json(
          { error: "Herberekend, maar het auditspoor mislukte" },
          500,
        );
      }
      return json(uitkomst);
    }

    // ---- Muterende acties (#1036 deel 2) ------------------------------------
    default:
      return await voerMutatieUit(toegang.actie, toegang.uid, body);
  }
});

/**
 * De acties die iets aan een account veranderen. Elk pad laat een auditrij
 * achter; slaagt die insert niet, dan geldt de actie als mislukt. Een
 * wachtwoord uitdelen zonder spoor is erger dan het niet uitdelen.
 *
 * delete_user wijkt af en schrijft zijn rij vooraf: daarna bestaat het profiel
 * niet meer en valt er niets meer te loggen.
 */
async function voerMutatieUit(
  actie: AdminActie,
  actorId: string,
  body: { user_id?: unknown; email?: unknown; username?: unknown; wat?: unknown },
): Promise<Response> {
  const targetId = body.user_id;
  if (typeof targetId !== "string" || targetId === "") {
    return json({ error: "user_id vereist" }, 400);
  }

  // Het doelaccount ophalen: we hebben zijn e-mailadres nodig voor de
  // link/mail-acties, en het bestaan ervan wil je vaststellen vóór je iets doet.
  const { data: doel, error: doelFout } =
    await admin.auth.admin.getUserById(targetId);
  if (doelFout || !doel?.user) {
    return json({ error: "Gebruiker niet gevonden" }, 404);
  }
  const doelEmail = doel.user.email ?? "";

  let antwoord: Record<string, unknown>;
  let auditPayload: Record<string, unknown> = {};

  switch (actie) {
    case "recovery_link": {
      if (!doelEmail) {
        return json({ error: "Dit account heeft geen e-mailadres" }, 400);
      }
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: doelEmail,
      });
      if (error) return json({ error: error.message }, 500);

      // Bewust NIET data.properties.action_link. Die wijst naar
      // /auth/v1/verify?token=… en dat is een eenmalige verzilvering: elke
      // link-preview-bot (WhatsApp, Slack, een mailscanner) doet een GET zodra
      // je hem plakt en brandt het token op — precies in het kanaal waarvoor
      // deze knop bestaat.
      //
      // We bouwen de link daarom zelf uit hashed_token, naar dezelfde
      // landingspagina die de auth-mails sinds #1037 gebruiken. Die wisselt het
      // token in met verifyOtp — in JavaScript, dat een bot niet uitvoert — en
      // stuurt bij type=recovery door naar /reset-wachtwoord. Eén route voor
      // alle herstelpaden; geen tweede verzilvering die apart kan gaan afwijken.
      const hash = data?.properties?.hashed_token;
      if (!hash) return json({ error: "Geen herstel-token ontvangen" }, 500);
      const link = `${SITE_URL}/auth/bevestigen?token_hash=${encodeURIComponent(hash)}&type=recovery`;

      antwoord = { link, vervalt_over_minuten: OTP_GELDIG_MINUTEN };
      auditPayload = { vervalt_over_minuten: OTP_GELDIG_MINUTEN };
      break;
    }

    case "temp_password": {
      const wachtwoord = genereerWachtwoord();
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        password: wachtwoord,
      });
      if (error) return json({ error: error.message }, 500);

      // Deze volgorde is verplicht en niet inwisselbaar: de wachtwoordwissel
      // hierboven vuurt on_auth_password_changed, die de vlag wist. Zetten we
      // hem eerst, dan haalt de trigger hem meteen weer weg en komt de gebruiker
      // gewoon binnen met het tijdelijke wachtwoord.
      const { error: vlagFout } = await admin
        .from("profiles")
        .update({ moet_wachtwoord_wijzigen: true })
        .eq("id", targetId);
      if (vlagFout) return json({ error: vlagFout.message }, 500);

      antwoord = { wachtwoord };
      break;
    }

    case "resend_reset": {
      if (!doelEmail) {
        return json({ error: "Dit account heeft geen e-mailadres" }, 400);
      }
      const { error } = await admin.auth.resetPasswordForEmail(doelEmail, {
        redirectTo: `${SITE_URL}/reset-wachtwoord`,
      });
      if (error) return json({ error: error.message }, 500);
      antwoord = { ok: true };
      break;
    }

    case "fix_email": {
      const nieuw = body.email;
      if (typeof nieuw !== "string" || !nieuw.includes("@")) {
        return json({ error: "Geen geldig e-mailadres" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        email: nieuw,
        // Zonder dit blijft het account op een bevestiging wachten die naar het
        // nieuwe adres gaat — terwijl de reden voor deze actie meestal juist is
        // dat er geen mail aankomt.
        email_confirm: true,
      });
      if (error) return json({ error: error.message }, 500);
      antwoord = { ok: true, email: nieuw };
      auditPayload = { van: doelEmail, naar: nieuw };
      break;
    }

    case "sign_out_all": {
      // auth.admin.signOut(jwt) kan hier niet: dat vraagt een geldig
      // access-token ván de doelgebruiker. De RPC verwijdert zijn sessies.
      const { data, error } = await admin.rpc("admin_trek_sessies_in", {
        p_uid: targetId,
      });
      if (error) return json({ error: error.message }, 500);
      antwoord = { ok: true, sessies: data ?? 0 };
      auditPayload = { sessies: data ?? 0 };
      break;
    }

    // Gegevensexport vóór een ander (#1049).
    //
    // exporteerMijnGegevens() in de app stelt hem client-side samen en leunt
    // bewust op RLS — die bepaalt al precies wat jij mag zien. Precies daarom
    // kan een beheerder hem niet vóór een ander draaien, en dat is nou net het
    // geval waarin je hem nodig hebt: iemand die er niet meer in komt.
    //
    // Géén mutatie, wél een auditrij: iemands volledige gegevens ophalen is
    // even gevoelig als een wachtwoord uitdelen. Wat er in het logboek belandt
    // is de omvang, niet de inhoud — het spoor hoort geen tweede kopie te zijn.
    case "export_user": {
      const { data, error } = await admin.rpc("admin_export_user", {
        p_uid: targetId,
      });
      if (error) return json({ error: error.message }, 500);
      if (data === null) return json({ error: "Gebruiker niet gevonden" }, 404);

      const uitvoer = data as Record<string, unknown>;
      const profiel = uitvoer.profiel as { username?: string } | null;
      antwoord = { export: uitvoer };
      auditPayload = {
        username: profiel?.username ?? null,
        matches: Array.isArray(uitvoer.matches) ? uitvoer.matches.length : 0,
        groepen: Array.isArray(uitvoer.groepen) ? uitvoer.groepen.length : 0,
      };
      break;
    }

    case "delete_user": {
      if (targetId === actorId) {
        return json({ error: "Je kunt je eigen account hier niet verwijderen" }, 400);
      }

      // De ingetikte username moet kloppen. De dialoog in de app vraagt er ook
      // om, maar dát is ergonomie; dit is de grendel. Zonder deze check zit
      // "verwijder gebruiker X" één verkeerd id van een ramp af.
      const { data: profiel } = await admin
        .from("profiles")
        .select("username")
        .eq("id", targetId)
        .maybeSingle();
      if (!profiel) return json({ error: "Gebruiker niet gevonden" }, 404);
      if (body.username !== profiel.username) {
        return json({ error: "Bevestiging klopt niet" }, 400);
      }

      // Alles wat we straks niet meer kunnen opzoeken, nú vastleggen: na de
      // delete bestaat het profiel niet meer. Groepen waarvan deze persoon
      // eigenaar is verliezen hun eigenaar (groups.created_by is `on delete set
      // null`) en worden daarmee onbeheerbaar — zie #1049. Het logboek moet in
      // elk geval vertellen hoeveel dat er waren.
      const [{ count: gasten }, { count: groepen }] = await Promise.all([
        admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", targetId),
        admin
          .from("groups")
          .select("id", { count: "exact", head: true })
          .eq("created_by", targetId),
      ]);
      auditPayload = {
        username: profiel.username,
        gasten: gasten ?? 0,
        groepen_zonder_eigenaar: groepen ?? 0,
      };

      // Auditrij vóór de verwijdering. Andersom zou een mislukte insert een
      // spoorloze verwijdering opleveren, en dat is precies het geval waarin je
      // het logboek nodig hebt.
      const { error: vooraf } = await admin.from("admin_audit_log").insert({
        actor_id: actorId,
        action: actie,
        target_user_id: targetId,
        details: veiligeDetails(actie, auditPayload),
      });
      if (vooraf) {
        return json({ error: "Auditspoor mislukte, er is niets verwijderd" }, 500);
      }

      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) {
        // Komt voor: matches.team_a_id/team_b_id zijn `on delete restrict`, dus
        // een speler met wedstrijden kan de cascade laten falen (#937). Geef de
        // echte melding door in plaats van te doen alsof het gelukt is.
        return json({ error: `Verwijderen mislukte: ${error.message}` }, 500);
      }
      return json({ ok: true, groepen_zonder_eigenaar: groepen ?? 0 });
    }

    default:
      return json({ error: "Onbekende actie" }, 400);
  }

  const { error: auditFout } = await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    action: actie,
    target_user_id: targetId,
    details: veiligeDetails(actie, auditPayload),
  });
  if (auditFout) {
    // Geen stille mislukking: de actie is intussen wél gebeurd, dus dit moet
    // opvallen in plaats van als "gelukt" door te gaan.
    return json({ error: "Actie uitgevoerd, maar het auditspoor mislukte" }, 500);
  }

  return json(antwoord);
}
