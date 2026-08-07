// Edge Function: stuurt X uur vóór een geplande match een push naar de 4 spelers.
// Bedoeld om periodiek door pg_cron aangeroepen te worden (zie
// ../../snippets/match_reminder_cron.sql). Per groep en speeldag gaat er
// hooguit één herinnering de deur uit — die van de vroegste match (#827) —
// en wordt de rest van die avond stil afgevinkt. Afgehandelde matches worden
// in public.match_reminders bijgehouden.
//
// Tweede taak (#804): zodra een match begonnen is, krijgt de partner van wie
// zijn lef inzette een melding dat er naast hem dubbel of niets gespeeld wordt.
// Vóór de aftrap blijft die inzet verborgen; dedup via public.match_lef_notices.
//
// Beide meldingen lopen via de gedeelde bezorger (#1090,
// ../_shared/meldingenBezorger.ts): die schrijft eerst de rij in
// public.notifications en filtert pas daarna op notify_match_reminder, zodat de
// herinnering ook in de app staat voor wie geen push (meer) krijgt.
//
// Deploy ZONDER JWT-verificatie:
//   supabase functions deploy match-reminders --no-verify-jwt
// en beveilig met een gedeeld geheim:
//   supabase secrets set CRON_SECRET=<willekeurige-lange-string>
// De cron-job stuurt dat geheim mee in de header 'x-cron-secret'.
//
// Extra secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…),
// en optioneel REMINDER_HOURS (standaard 3). SUPABASE_URL en
// SUPABASE_SERVICE_ROLE_KEY worden automatisch meegegeven.

import { createClient } from "npm:@supabase/supabase-js@2";
import { bezorg, type Melding } from "../_shared/meldingenBezorger.ts";
import {
  JOUW_BEURT,
  JOUW_BEURT_NEUTRAAL,
  kiesTitel,
  kiesUit,
  LEF_PARTNER,
  type RoastIntensiteit,
  roastSeed,
  TITEL_JOUW_BEURT,
  TITEL_LEF_PARTNER,
} from "../_shared/roast.ts";
import { cronGuard } from "../_shared/cronAuth.ts";
import { bundelPerSpeeldag } from "../_shared/reminderBundel.ts";
import { onthullingenVoorPartners } from "../_shared/lefOnthulling.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const REMINDER_HOURS = Number(Deno.env.get("REMINDER_HOURS") ?? "3");
/** Minuten ná de aftrap waarbinnen de lef-onthulling nog vertrekt (#804).
 *  Ruimer dan de crontik (elk kwartier), zodat een match die net na een tik
 *  begint niet tussen wal en schip valt; match_lef_notices houdt het daarna bij
 *  één melding per match. */
const LEF_NOTICE_MIN = Number(Deno.env.get("LEF_NOTICE_MINUTES") ?? "30");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
// Clubtijd, dezelfde constante als poll-deadline en dayInZone in de client.
const TIME_ZONE = "Europe/Brussels";

type MatchRow = {
  id: string;
  team_a_id: string;
  team_b_id: string;
  group_id: string | null;
  played_at: string;
};

async function playersOf(match: MatchRow): Promise<string[]> {
  const { data } = await admin
    .from("teams")
    .select("player1_id, player2_id")
    .in("id", [match.team_a_id, match.team_b_id]);
  return (data ?? []).flatMap((t) => [t.player1_id, t.player2_id]);
}

Deno.serve(async (req) => {
  // Alleen aanroepbaar met het juiste cron-geheim (fail-closed, #460).
  const denied = cronGuard(req, CRON_SECRET);
  if (denied) return denied;

  const now = Date.now();
  const until = new Date(now + REMINDER_HOURS * 3600_000).toISOString();
  const nowIso = new Date(now).toISOString();

  // Geplande matches die binnen het herinneringsvenster beginnen.
  const { data: matches } = await admin
    .from("matches")
    .select("id, team_a_id, team_b_id, group_id, played_at")
    .eq("status", "scheduled")
    .not("played_at", "is", null)
    .gte("played_at", nowIso)
    .lte("played_at", until);

  // Al eerder herinnerde matches overslaan.
  const { data: already } = await admin.from("match_reminders").select("match_id");
  const done = new Set((already ?? []).map((r) => r.match_id));

  // Eén herinnering per groepsdag (#827): sinds gegenereerde rondes een echte
  // starttijd hebben, valt een hele avond in het venster en zou elke ronde een
  // eigen push sturen. De rest van de avond wordt stil afgevinkt.
  const bundels = bundelPerSpeeldag(
    ((matches ?? []) as MatchRow[]).filter((m) => !done.has(m.id)),
    TIME_ZONE,
  );

  let reminded = 0;
  let onderdrukt = 0;
  // De meldingen van alle bundels samen; bezorg() schrijft ze en filtert daarna
  // pas op notify_match_reminder (#1090).
  const meldingen: Melding[] = [];
  for (const bundel of bundels) {
    const m = bundel.herinner;
    const players = await playersOf(m);
    const when = new Date(m.played_at);
    // Zonder tijdzone rekent Deno in UTC en meldt een match van 20:00 als
    // "18:00" (#795).
    const time = when.toLocaleTimeString("nl-NL", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
    });
    const url = m.group_id ? `/groepen/${m.group_id}` : `/matches/${m.id}`;
    // "Jouw beurt" in Rudy's stem (#302): per speler een eigen tekst, zodat het
    // schild + de intensiteit gerespecteerd worden. Schild aan (of profiel weg)
    // → een neutrale aanmoediging. Deterministisch geseed op (match, speler).
    const { data: profielen } = await admin
      .from("profiles")
      .select("id, roast_schild, roast_intensiteit")
      .in("id", players);
    const profielVan = new Map((profielen ?? []).map((p) => [p.id, p]));
    for (const pid of players) {
      const p = profielVan.get(pid);
      const seed = roastSeed(m.id, pid);
      const quip = !p || p.roast_schild
        ? kiesUit(JOUW_BEURT_NEUTRAAL, seed)
        : kiesUit(
          JOUW_BEURT[(p.roast_intensiteit ?? "radioactief") as RoastIntensiteit],
          seed,
        );
      meldingen.push({
        recipients: [pid],
        // Titel per speler uit een pool (#189): vier spelers in dezelfde ronde
        // kregen anders vier identieke meldingen te zien.
        title: kiesTitel(TITEL_JOUW_BEURT, m.id, pid),
        body: `Om ${time} sta je op de baan. ${quip}`,
        url,
        soort: "speeldag_herinnering",
        // Eén tag per speeldag: een tweede herinnering vervangt de eerste.
        tag: `speeldag-${m.group_id ?? m.id}`,
      });
    }
    // De herinnerde match én de rest van die avond ineens afvinken, zodat een
    // latere cron-tik ze niet alsnog oppikt.
    await admin
      .from("match_reminders")
      .insert([m, ...bundel.onderdruk].map((x) => ({ match_id: x.id })));
    reminded += 1;
    onderdrukt += bundel.onderdruk.length;
  }

  const { sent } = await bezorg(admin, meldingen);

  // ── Lef-onthulling bij de aftrap (#804) ───────────────────────────────────
  // Vóór de aftrap houdt de app een inzet verborgen, anders kun je erop
  // meeliften. Zodra de match loopt hoort je partner te weten dat er naast hem
  // dubbel of niets gespeeld wordt — dat verandert hoe je de match ingaat.
  // Inzetten kan niet meer na de starttijd (match_stakes_guard), dus wat we hier
  // vinden is definitief en één melding per match volstaat.
  const sinds = new Date(now - LEF_NOTICE_MIN * 60_000).toISOString();
  const { data: begonnen } = await admin
    .from("matches")
    .select("id, team_a_id, team_b_id, group_id, played_at")
    .not("group_id", "is", null)
    .gte("played_at", sinds)
    .lte("played_at", nowIso);

  let lefSent = 0;
  const verse = (begonnen ?? []) as MatchRow[];
  if (verse.length > 0) {
    const { data: gemeld } = await admin
      .from("match_lef_notices")
      .select("match_id")
      .in("match_id", verse.map((m) => m.id));
    const al = new Set((gemeld ?? []).map((r) => r.match_id));
    const nieuw = verse.filter((m) => !al.has(m.id));
    if (nieuw.length > 0) {
      const { data: stakes } = await admin
        .from("match_stakes")
        .select("match_id, player_id")
        .in("match_id", nieuw.map((m) => m.id));
      const { data: teams } = await admin
        .from("teams")
        .select("id, player1_id, player2_id")
        .in("id", nieuw.flatMap((m) => [m.team_a_id, m.team_b_id]));
      const onthullingen = onthullingenVoorPartners(
        nieuw,
        teams ?? [],
        stakes ?? [],
      );
      if (onthullingen.length > 0) {
        const { data: namen } = await admin
          .from("profiles")
          .select("id, username, full_name")
          .in("id", onthullingen.map((o) => o.inzetterId));
        const naamVan = new Map(
          (namen ?? []).map((p) => [
            p.id,
            (p.full_name?.trim() || p.username) as string,
          ]),
        );
        // De voorkeur (#57) zit in het soort: 'lef' hangt aan dezelfde
        // notify_match_reminder-schakelaar als de herinnering zelf, en bezorg()
        // past hem toe ná het schrijven van de rij.
        const lefMeldingen: Melding[] = onthullingen.map((o) => {
          const naam = naamVan.get(o.inzetterId) ?? "Je partner";
          return {
            recipients: [o.partnerId],
            title: kiesTitel(TITEL_LEF_PARTNER, o.matchId, o.partnerId),
            body: `${naam} zette lef in: dubbel of niets. ${
              kiesUit(LEF_PARTNER, roastSeed(o.matchId, o.partnerId))
            }`,
            url: `/matches/${o.matchId}`,
            soort: "lef",
            tag: `lef-${o.matchId}`,
          };
        });
        lefSent = (await bezorg(admin, lefMeldingen)).sent;
      }
      // Ook matches zonder inzet afvinken: dan valt er niets te melden en hoeft
      // de volgende crontik er niet meer naar te kijken.
      await admin
        .from("match_lef_notices")
        .insert(nieuw.map((m) => ({ match_id: m.id })));
    }
  }

  return new Response(JSON.stringify({ reminded, sent, onderdrukt, lef: lefSent }), {
    headers: { "content-type": "application/json" },
  });
});
