// De bezorging van een melding (#1090): rij eerst, push daarna.
//
// Vóór #1090 hadden send-push, match-reminders, poll-deadline en remind-group
// elk hun eigen kopie van deze lus (inclusief dezelfde 404/410-opruiming en
// dezelfde setVapidDetails-regels). Eén vijfde functie erbij en ze liepen uit de
// pas. Nu is dit de enige plek waar webpush.sendNotification staat.
//
// De volgorde is de kern van het ontwerp:
//   1. de rijen, voor ÁLLE ontvangers — ook wie geen abonnement heeft, en ook
//      wie de bijbehorende notify_*-schakelaar uitzette;
//   2. pas dan de voorkeurfilter, die alleen over het toestel gaat;
//   3. pas dan de push, waarvan het mislukken de rij niet raakt.
//
// De beslissingen (soorten, voorkeurkolommen, rij-opbouw) staan in meldingen.ts
// en zijn daar los unit-getest; hier staat alleen het recept.

import webpush from "npm:web-push@3.6.7";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  type Melding,
  meldingRijen,
  VOORKEUR_KOLOM,
  zonderUitgezet,
} from "./meldingen.ts";

import { isAan } from "./instellingen.ts";

export type { Melding, Soort } from "./meldingen.ts";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");

// Ontbreken de sleutels, dan bezorgen we niets — maar schrijven we wél. Vóór
// #1090 riepen alle vier de functies dit onvoorwaardelijk aan met een `!`, en
// dan klapt de hele function bij het opstarten. Dat kostte destijds niets omdat
// er zonder push toch niets te doen was; nu zou het de inbox meesleuren.
const vapidGereed = !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY;
if (vapidGereed) {
  webpush.setVapidDetails(
    VAPID_SUBJECT ?? "mailto:beheer@vamos.example",
    VAPID_PUBLIC_KEY!,
    VAPID_PRIVATE_KEY!,
  );
} else {
  console.warn("[meldingen] VAPID-sleutels ontbreken — alleen rijen, geen push");
}

export type BezorgResultaat = {
  /** Aantal weggeschreven of bijgewerkte rijen in public.notifications. */
  rijen: number;
  /** Aantal geslaagde web-pushes (per abonnement, niet per persoon). */
  sent: number;
  /** Aantal ontvangers dat na de voorkeurfilter overbleef. */
  ontvangers: number;
};

/**
 * Schrijf de meldingen en bezorg ze.
 *
 * `admin` moet een service-role-client zijn: meldingen_schrijven is alleen voor
 * service_role uitvoerbaar, en push_subscriptions wordt buiten RLS om gelezen.
 */
export async function bezorg(
  admin: SupabaseClient,
  meldingen: Melding[],
): Promise<BezorgResultaat> {
  const resultaat: BezorgResultaat = { rijen: 0, sent: 0, ontvangers: 0 };
  if (meldingen.length === 0) return resultaat;

  // 1. De rijen. Alles in één aanroep: de RPC ontdubbelt zelf op (ontvanger,
  //    tag) en slaat gasten en onbekende id's over.
  const rijen = meldingRijen(meldingen);
  if (rijen.length > 0) {
    const { data, error } = await admin.rpc("meldingen_schrijven", {
      p_meldingen: rijen,
    });
    if (error) {
      // Niet fataal: een mislukte inbox mag de push niet tegenhouden, net zomin
      // als andersom. Wel luid, want dit is de bron van waarheid.
      console.error("[meldingen] wegschrijven faalde", error);
    } else {
      resultaat.rijen = typeof data === "number" ? data : 0;
    }
  }

  // 2. De kill switch (#1049). Bewust hier en niet bij stap 1: de inbox blijft
  //    gevuld, alleen de web-push gaat niet de deur uit. Wie de schakelaar
  //    omzet omdat de bezorging spamt of stuk is, wil niet ook de meldingen
  //    zelf kwijt — die staan bij de volgende app-opening gewoon in de inbox
  //    (#1090). Dit is het enige knooppunt waar álle uitgaande push langskomt.
  if (!(await isAan(admin, "push"))) {
    console.log("[meldingen] push staat uit (app_settings), enkel inbox");
    return resultaat;
  }

  // 3 + 4. Per melding: filteren op de voorkeur en bezorgen.
  for (const melding of meldingen) {
    const ontvangers = await metVoorkeur(admin, melding);
    if (ontvangers.length === 0) continue;
    resultaat.ontvangers += ontvangers.length;
    resultaat.sent += await push(admin, ontvangers, melding);
  }

  return resultaat;
}

/** De ontvangers die dit soort push niet hebben uitgezet (#57). */
async function metVoorkeur(
  admin: SupabaseClient,
  melding: Melding,
): Promise<string[]> {
  const kolom = VOORKEUR_KOLOM[melding.soort];
  const ontvangers = [...new Set(melding.recipients.filter(Boolean))];
  if (!kolom || ontvangers.length === 0) return ontvangers;

  const { data } = await admin
    .from("profiles")
    .select(`id, ${kolom}`)
    .in("id", ontvangers);
  // Via unknown: de kolomnaam is dynamisch, dus postgrest-js kan het rijtype
  // niet afleiden en levert een ParserError-type op.
  return zonderUitgezet(
    ontvangers,
    kolom,
    (data ?? []) as unknown as Record<string, unknown>[],
  );
}

/** De web-push zelf, met opruiming van verlopen abonnementen. */
async function push(
  admin: SupabaseClient,
  ontvangers: string[],
  melding: Melding,
): Promise<number> {
  if (!vapidGereed) return 0;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", ontvangers);

  // Exact de vier velden die public/sw.js uitleest.
  const payload = JSON.stringify({
    title: melding.title,
    body: melding.body,
    url: melding.url,
    tag: melding.tag,
  });

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent += 1;
      } catch (err) {
        // Verlopen/ingetrokken abonnementen opruimen.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        }
      }
    }),
  );
  return sent;
}
