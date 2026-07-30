// Edge Function: verstuurt web-push-meldingen op basis van database-webhooks.
//
// Events (zie ../../snippets/push_webhooks.sql voor de triggers):
//  - INSERT op matches met status != completed  → "Nieuwe ronde" naar de 4 spelers
//  - UPDATE op matches naar status = completed  → "Uitslag ingevoerd" naar de 4 spelers
//  - INSERT op friendships (pending)            → "Vriendschapsverzoek" naar de ontvanger
//
// Coach Rudy's stem (#302): de nieuwe-ronde-, vriendschaps- en poll-teksten
// zijn on-brand. De nieuwe ronde gaat per speler (respecteert schild +
// intensiteit, zie personalMessages); vriendschap/polls zijn niet-kwetsend en
// gebruiken één schild-neutrale pool.
//  - INSERT/UPDATE op pias_of_week (#203)       → Coach Rudy-sneer naar de pias zelf
//  - UPDATE op player_rank_state (#302)         → promotie/degradatie in het
//    groepsklassement: felicitatie of sneer, richting uit old.tier vs new.tier
//  - UPDATE op matches met een afdroging (#409) → Rudy-sneer voor de verliezers,
//    een schouderklopje voor de winnaars, i.p.v. de neutrale "Uitslag ingevoerd"
//
// Meer variatie (#189): sinds deze ronde splitst óók een gewone uitslag in
// winst/verlies (WINST_LOF vs VERLIES_SNEER), kiest elke melding haar titel uit
// een pool in plaats van één vaste regel, en draagt elke push een 'tag' zodat
// meldingen over dezelfde gebeurtenis elkaar op het toestel vervangen.
//
// Notificatie-voorkeuren (#57): de notify_*-kolommen op profiles bepalen per
// type wie een push krijgt (nieuwe ronde, uitslag, vriendschapsverzoek).
//
// Vereiste secrets (supabase secrets set):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
//   CRON_SECRET — gedeeld geheim dat de webhook meestuurt als 'x-cron-secret'
//     (#459). De functie draait --no-verify-jwt, dus dit is de énige gate:
//     zonder correct geheim weigert ze. Zelfde secret als de cron-functies.
// SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden automatisch meegegeven.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import {
  AFDROGING_LOF,
  afdrogingLabel,
  BAGEL_SNEER,
  kiesTitel,
  kiesUit,
  MONSTER_SNEER,
  NIEUWE_MATCH,
  NIEUWE_MATCH_NEUTRAAL,
  PIAS_SNEER,
  POLL_GEBOEKT,
  POLL_MOMENT,
  POLL_NIEUW,
  RANK_DEGRADATIE,
  RANK_DEGRADATIE_NEUTRAAL,
  RANK_PROMOTIE,
  rangOvergang,
  type RoastIntensiteit,
  roastSeed,
  TITEL_LOF,
  TITEL_NIEUWE_RONDE,
  TITEL_POLL_GEBOEKT,
  TITEL_POLL_MOMENT,
  TITEL_POLL_NIEUW,
  TITEL_PROMOTIE,
  TITEL_SNEER,
  TITEL_UITSLAG,
  TITEL_VRIENDSCHAP,
  TITEL_WINST,
  UITSLAG_NEUTRAAL,
  VERLIES_SNEER,
  VRIENDSCHAP,
  WINST_LOF,
} from "../_shared/roast.ts";

// Gedeeld geheim voor de database-webhook (#459). Bewust fail-closed: is het
// niet gezet, dan weigert de handler álles (i.p.v. de fail-open cron-guards
// die de check overslaan als de secret ontbreekt).
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:beheer@vamos.example",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

type MatchRecord = {
  id: string;
  team_a_id: string;
  team_b_id: string;
  status: string;
  score_a: number | null;
  score_b: number | null;
  winner_team_id: string | null;
  group_id: string | null;
};

type PiasRecord = {
  group_id: string;
  iso_year: number;
  iso_week: number;
  player_id: string;
  match_id: string;
  win_chance: number;
  week_start: string; // YYYY-MM-DD (maandag van de ISO-week)
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
};

// Notificatie-types waarvoor de gebruiker een voorkeur kan zetten (#57);
// de namen mappen op de notify_*-kolommen van profiles.
type MessageKind = "new_round" | "result" | "friend_request" | "rank_change";

type Message = {
  recipients: string[];
  title: string;
  body: string;
  url: string;
  // null = altijd sturen: polls hebben (nog) geen voorkeur, en pias filtert
  // zichzelf al via roast_schild in messagesFor.
  kind: MessageKind | null;
  /** Notificatie-tag (#189): meldingen met dezelfde tag vervangen elkaar op het
   *  toestel. Bewust per gebeurtenis, niet per soort — zo vouwt een reeks
   *  ineens gegenereerde rondes (#827) samen tot één melding, terwijl twee
   *  verschillende matches gewoon los blijven staan. */
  tag: string;
};

async function playersOf(match: MatchRecord): Promise<string[]> {
  const { data } = await supabase
    .from("teams")
    .select("player1_id, player2_id")
    .in("id", [match.team_a_id, match.team_b_id]);
  return (data ?? []).flatMap((t) => [t.player1_id, t.player2_id]);
}

/** Spelers per team-id (#409): nodig om bij een afdroging winnaars en verliezers
 *  te scheiden, waar playersOf beide teams platslaat. */
async function playersByTeam(
  match: MatchRecord,
): Promise<Record<string, string[]>> {
  const { data } = await supabase
    .from("teams")
    .select("id, player1_id, player2_id")
    .in("id", [match.team_a_id, match.team_b_id]);
  const byTeam: Record<string, string[]> = {};
  for (const t of data ?? []) byTeam[t.id] = [t.player1_id, t.player2_id];
  return byTeam;
}

async function nameOf(playerId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("username, full_name")
    .eq("id", playerId)
    .maybeSingle();
  return data?.full_name?.trim() || data?.username || "Een speler";
}

/** Maandag van de huidige ISO-week als YYYY-MM-DD, in UTC — dezelfde klok
 *  als week_start uit recompute_pias (Postgres draait op UTC). */
function mondayOfCurrentWeek(): string {
  const nu = new Date();
  const maandag = new Date(nu);
  maandag.setUTCDate(nu.getUTCDate() - ((nu.getUTCDay() + 6) % 7));
  return maandag.toISOString().slice(0, 10);
}

async function messagesFor(payload: WebhookPayload): Promise<Message[]> {
  if (payload.table === "friendships" && payload.type === "INSERT") {
    const rec = payload.record as {
      requester_id: string;
      addressee_id: string;
      status: string;
    };
    if (rec.status !== "pending") return [];
    // Rudy's stem (#302): informatieve eerste zin + een lichte plaag. Niet-
    // kwetsend en één ontvanger, dus één schild-neutrale pool. Seed op het paar.
    const quip = kiesUit(
      VRIENDSCHAP,
      roastSeed(rec.requester_id, rec.addressee_id),
    );
    return [{
      recipients: [rec.addressee_id],
      title: kiesTitel(TITEL_VRIENDSCHAP, rec.requester_id, rec.addressee_id),
      body: `${await nameOf(rec.requester_id)} wil met je padellen. ${quip}`,
      url: "/vrienden",
      kind: "friend_request",
      tag: `vriendschap-${rec.requester_id}`,
    }];
  }

  if (payload.table === "matches" && payload.type === "INSERT") {
    const rec = payload.record as unknown as MatchRecord;
    // Alleen geplande (gegenereerde) matches; direct gelogde uitslagen niet.
    if (rec.status === "completed") return [];
    // Nieuwe ronde in Rudy's stem (#302): per speler een eigen tekst zodat het
    // schild + de intensiteit gerespecteerd worden, seed op (match, speler).
    return await personalMessages({
      recipients: await playersOf(rec),
      neutraal: NIEUWE_MATCH_NEUTRAAL,
      pool: NIEUWE_MATCH,
      seedKey: `nieuwe-match|${rec.id}`,
      titelPool: TITEL_NIEUWE_RONDE,
      url: rec.group_id ? `/groepen/${rec.group_id}` : "/matches",
      kind: "new_round",
      // Eén tag per groep: worden er in één klap vier rondes klaargezet (#827),
      // dan houdt de speler één melding over in plaats van vier trillingen.
      tag: `nieuwe-ronde-${rec.group_id ?? rec.id}`,
    });
  }

  if (payload.table === "matches" && payload.type === "UPDATE") {
    const rec = payload.record as unknown as MatchRecord;
    const old = payload.old_record as unknown as MatchRecord | null;
    if (rec.status !== "completed" || old?.status === "completed") return [];
    return await matchResultMessages(rec);
  }

  // Speeldag-polls: nieuwe poll → hele groep; gelockt/geboekt → de stemmers.
  if (payload.table === "play_polls") {
    const rec = payload.record as {
      id: string;
      group_id: string;
      created_by: string;
      status: string;
      locked_option_id: string | null;
    };
    const old = payload.old_record as { status?: string } | null;

    if (payload.type === "INSERT") {
      const { data: members } = await supabase
        .from("group_members")
        .select("player_id")
        .eq("group_id", rec.group_id);
      return [{
        recipients: (members ?? [])
          .map((m) => m.player_id)
          .filter((id) => id !== rec.created_by),
        title: kiesTitel(TITEL_POLL_NIEUW, rec.id),
        body: `${await nameOf(rec.created_by)} stelt momenten voor. ${
          kiesUit(POLL_NIEUW, roastSeed(rec.id, "poll-nieuw"))
        }`,
        url: `/groepen/${rec.group_id}?tab=plannen`,
        kind: null,
        tag: `poll-${rec.id}`,
      }];
    }

    if (
      payload.type === "UPDATE" &&
      old?.status === "open" &&
      rec.status === "locked" &&
      rec.locked_option_id
    ) {
      const moment = await pollMoment(rec.locked_option_id);
      const voters = await pollVoters(rec.id);
      return [{
        recipients: voters,
        title: kiesTitel(TITEL_POLL_MOMENT, rec.id, "locked"),
        body: `De groep speelt ${moment}. ${
          kiesUit(POLL_MOMENT, roastSeed(rec.id, "locked"))
        }`,
        url: `/groepen/${rec.group_id}?tab=plannen`,
        kind: null,
        tag: `poll-${rec.id}`,
      }];
    }

    if (
      payload.type === "UPDATE" &&
      old?.status !== "booked" &&
      rec.status === "booked" &&
      rec.locked_option_id
    ) {
      const moment = await pollMoment(rec.locked_option_id);
      const yes = await optionYesVoters(rec.locked_option_id);
      return [{
        recipients: yes,
        title: kiesTitel(TITEL_POLL_GEBOEKT, rec.id, "booked"),
        body: `Jullie spelen ${moment}. ${
          kiesUit(POLL_GEBOEKT, roastSeed(rec.id, "booked"))
        }`,
        url: `/groepen/${rec.group_id}?tab=plannen`,
        kind: null,
        tag: `poll-${rec.id}`,
      }];
    }
  }

  // Pias van de week (#203): Coach Rudy plaagt alleen de pias zelf. De
  // webhook-triggers filteren al op huidige week + echte wissel; dezelfde
  // guards staan hier nogmaals voor handmatige of geretryde webhooks.
  if (
    payload.table === "pias_of_week" &&
    (payload.type === "INSERT" || payload.type === "UPDATE")
  ) {
    const rec = payload.record as unknown as PiasRecord;
    const old = payload.old_record as unknown as PiasRecord | null;
    if (rec.week_start !== mondayOfCurrentWeek()) return [];
    if (payload.type === "UPDATE" && old?.player_id === rec.player_id) {
      return [];
    }

    const { data: profiel } = await supabase
      .from("profiles")
      .select("roast_schild, roast_intensiteit")
      .eq("id", rec.player_id)
      .maybeSingle();
    // Schild aan (of profiel weg) → Coach Rudy zwijgt, net als in de feed.
    if (!profiel || profiel.roast_schild) return [];

    const seed = roastSeed(rec.player_id, `${rec.iso_year}-W${rec.iso_week}`);
    const intensiteit = (profiel.roast_intensiteit ?? "radioactief") as RoastIntensiteit;
    return [{
      recipients: [rec.player_id],
      title: kiesTitel(TITEL_SNEER, rec.player_id, `${rec.iso_year}-W${rec.iso_week}`),
      body: `Jij bent de pias van de week. ${kiesUit(PIAS_SNEER[intensiteit], seed)}`,
      url: `/groepen/${rec.group_id}?tab=stand`,
      kind: null,
      tag: `pias-${rec.group_id}-${rec.iso_year}-W${rec.iso_week}`,
    }];
  }

  // Promotie/degradatie (#302): een tier-overgang in het groepsklassement. De
  // webhook-trigger vuurt al enkel bij een echte tier-wissel (zonder 'nieuw');
  // rangOvergang bepaalt richting + gebeurtenis, en het profiel de toon.
  if (payload.table === "player_rank_state" && payload.type === "UPDATE") {
    const rec = payload.record as {
      group_id: string;
      player_id: string;
      tier: string;
    };
    const old = payload.old_record as { tier: string } | null;
    if (!old) return [];
    const overgang = rangOvergang(old.tier, rec.tier);
    if (!overgang) return [];

    const { data: profiel } = await supabase
      .from("profiles")
      .select("roast_schild, roast_intensiteit")
      .eq("id", rec.player_id)
      .maybeSingle();
    if (!profiel) return [];

    const seed = roastSeed(rec.player_id, rec.group_id, rec.tier);
    const url = `/groepen/${rec.group_id}?tab=stand`;

    const tag = `rang-${rec.group_id}`;
    if (overgang.richting === "promotie") {
      // Felicitatie: positief, niet door het schild gedempt.
      return [{
        recipients: [rec.player_id],
        title: kiesTitel(TITEL_PROMOTIE, rec.player_id, rec.group_id, rec.tier),
        body: kiesUit(RANK_PROMOTIE[overgang.event], seed),
        url,
        kind: "rank_change",
        tag,
      }];
    }

    // Degradatie: schild aan → neutraal-feitelijk, anders een intensiteit-sneer.
    const intensiteit =
      (profiel.roast_intensiteit ?? "radioactief") as RoastIntensiteit;
    const body = profiel.roast_schild
      ? kiesUit(RANK_DEGRADATIE_NEUTRAAL[overgang.event], seed)
      : kiesUit(RANK_DEGRADATIE[overgang.event][intensiteit], seed);
    return [{
      recipients: [rec.player_id],
      title: kiesTitel(TITEL_SNEER, rec.player_id, rec.group_id, rec.tier),
      body,
      url,
      kind: "rank_change",
      tag,
    }];
  }

  return [];
}

/**
 * Bouwt per speler een eigen bericht in Rudy's stem (#302), met respect voor het
 * roast-schild + de intensiteit: schild aan (of profiel weg) → een neutrale
 * regel, anders een op intensiteit geschaalde plaag. Deterministisch op
 * (seedKey, speler-id) zodat een webhook-retry dezelfde tekst oplevert. Bewust
 * één bericht per speler, zoals de afdroging-verliezers (#409), zodat vier
 * spelers met verschillende voorkeuren elk hun eigen toon krijgen.
 */
async function personalMessages(opts: {
  recipients: string[];
  neutraal: readonly string[];
  pool: Record<RoastIntensiteit, readonly string[]>;
  seedKey: string;
  titelPool: readonly string[];
  url: string;
  kind: MessageKind | null;
  tag: string;
}): Promise<Message[]> {
  const { recipients, neutraal, pool, seedKey, titelPool, url, kind, tag } = opts;
  if (recipients.length === 0) return [];
  const { data: profielen } = await supabase
    .from("profiles")
    .select("id, roast_schild, roast_intensiteit")
    .in("id", recipients);
  const profielVan = new Map((profielen ?? []).map((p) => [p.id, p]));
  return recipients.map((pid) => {
    const p = profielVan.get(pid);
    const seed = roastSeed(seedKey, pid);
    // Schild aan of profiel onbekend → neutraal (fail-safe, geen plaag).
    const body = !p || p.roast_schild
      ? kiesUit(neutraal, seed)
      : kiesUit(pool[(p.roast_intensiteit ?? "radioactief") as RoastIntensiteit], seed);
    // Ook de titel per speler (#189): vier spelers in dezelfde ronde krijgen zo
    // niet vier identieke meldingen op hun scherm.
    return {
      recipients: [pid],
      title: kiesTitel(titelPool, seedKey, pid),
      body,
      url,
      kind,
      tag,
    };
  });
}

/**
 * De push-berichten bij een afgeronde match (#409, verbreed in #189). Winnaars
 * krijgen een schouderklopje en verliezers een Coach Rudy-sneer, tenzij hun
 * roast-schild aanstaat — dan de neutrale melding. Bij een bagel/monsterzege
 * zijn beide kanten forser (AFDROGING_LOF vs BAGEL/MONSTER_SNEER); bij een
 * gewone uitslag houdt Rudy het korter (WINST_LOF vs VERLIES_SNEER). Zonder
 * bekende winnaar of teamdata blijft het bij de neutrale melding voor iedereen.
 * Elke speler zit in precies één bericht: geen dubbele push voor dezelfde match.
 */
async function matchResultMessages(rec: MatchRecord): Promise<Message[]> {
  const url = `/matches/${rec.id}`;
  const tag = `uitslag-${rec.id}`;
  const heeftScore = rec.score_a != null && rec.score_b != null;
  const hoog = heeftScore ? Math.max(rec.score_a!, rec.score_b!) : 0;
  const laag = heeftScore ? Math.min(rec.score_a!, rec.score_b!) : 0;
  // Vanuit het perspectief van de ontvanger: de winnaar leest z'n eigen score
  // eerst, de verliezer ook. "Eindstand 6–3" zonder kant zei niemand iets.
  const winstZin = heeftScore ? `Gewonnen met ${hoog}–${laag}.` : "Gewonnen.";
  const verliesZin = heeftScore ? `Verloren met ${laag}–${hoog}.` : "Verloren.";

  const neutraal = (recipients: string[]): Message => ({
    recipients,
    title: kiesTitel(TITEL_UITSLAG, rec.id),
    body: `${
      heeftScore
        ? `Eindstand ${rec.score_a}–${rec.score_b}.`
        : "Jouw match is afgerond."
    } ${kiesUit(UITSLAG_NEUTRAAL, roastSeed(rec.id, "uitslag"))}`,
    url,
    kind: "result",
    tag,
  });

  if (!rec.winner_team_id) return [neutraal(await playersOf(rec))];

  const byTeam = await playersByTeam(rec);
  const winners = byTeam[rec.winner_team_id] ?? [];
  const loserTeamId = rec.winner_team_id === rec.team_a_id
    ? rec.team_b_id
    : rec.team_a_id;
  const losers = byTeam[loserTeamId] ?? [];
  // Teamdata weg → val terug op de neutrale melding voor iedereen.
  if (winners.length === 0 && losers.length === 0) {
    return [neutraal(await playersOf(rec))];
  }

  const label = afdrogingLabel(rec);
  const messages: Message[] = [];
  // Winnaars: één schouderklopje voor beide, deterministisch op de match-id.
  // Positief commentaar op de zege, dus niet door het schild gedempt.
  if (winners.length > 0) {
    const seed = roastSeed(rec.id, "winst");
    messages.push({
      recipients: winners,
      title: label
        ? kiesTitel(TITEL_LOF, rec.id, "winst")
        : kiesTitel(TITEL_WINST, rec.id, "winst"),
      body: label
        ? kiesUit(AFDROGING_LOF, seed)
        : `${winstZin} ${kiesUit(WINST_LOF, seed)}`,
      url,
      kind: "result",
      tag,
    });
  }

  // Verliezers: per speler bepaalt het schild roast of neutraal.
  const { data: profielen } = await supabase
    .from("profiles")
    .select("id, roast_schild, roast_intensiteit")
    .in("id", losers);
  const profielVan = new Map((profielen ?? []).map((p) => [p.id, p]));
  const neutraleVerliezers: string[] = [];
  for (const pid of losers) {
    const p = profielVan.get(pid);
    // Schild aan (of profiel weg) → geen sneer, wel de neutrale result-push.
    if (!p || p.roast_schild) {
      neutraleVerliezers.push(pid);
      continue;
    }
    const intensiteit = (p.roast_intensiteit ?? "radioactief") as RoastIntensiteit;
    const seed = roastSeed(rec.id, pid);
    // Een bagel/monsterzege benoemt zichzelf al; een gewone nederlaag krijgt de
    // uitslag als eerste zin mee.
    const afdroging = label === "bagel"
      ? BAGEL_SNEER
      : label === "monsterzege"
      ? MONSTER_SNEER
      : null;
    messages.push({
      recipients: [pid],
      title: kiesTitel(TITEL_SNEER, rec.id, pid),
      body: afdroging
        ? kiesUit(afdroging[intensiteit], seed)
        : `${verliesZin} ${kiesUit(VERLIES_SNEER[intensiteit], seed)}`,
      url,
      kind: "result",
      tag,
    });
  }
  if (neutraleVerliezers.length > 0) {
    messages.push(neutraal(neutraleVerliezers));
  }
  return messages;
}

/** "vrijdag 11 juli om 20:00" van de gekozen optie. */
async function pollMoment(optionId: string): Promise<string> {
  const { data } = await supabase
    .from("play_poll_options")
    .select("date, start_time")
    .eq("id", optionId)
    .maybeSingle();
  if (!data) return "binnenkort";
  const day = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${data.date}T12:00:00`));
  return `${day} om ${data.start_time}`;
}

/** Alle unieke stemmers op een poll (welke optie of status dan ook). */
async function pollVoters(pollId: string): Promise<string[]> {
  const { data: options } = await supabase
    .from("play_poll_options")
    .select("id")
    .eq("poll_id", pollId);
  const ids = (options ?? []).map((o) => o.id);
  if (ids.length === 0) return [];
  const { data: votes } = await supabase
    .from("play_poll_votes")
    .select("player_id")
    .in("option_id", ids);
  return [...new Set((votes ?? []).map((v) => v.player_id))];
}

/** De "ja"-stemmers op één optie. */
async function optionYesVoters(optionId: string): Promise<string[]> {
  const { data } = await supabase
    .from("play_poll_votes")
    .select("player_id")
    .eq("option_id", optionId)
    .eq("status", "yes");
  return [...new Set((data ?? []).map((v) => v.player_id))];
}

const PREF_COLUMN: Record<MessageKind, string> = {
  new_round: "notify_new_round",
  result: "notify_result",
  friend_request: "notify_friend_request",
  rank_change: "notify_rank_change",
};

/** Notificatie-voorkeuren (#57): laat alleen recipients over die dit
 *  push-type niet hebben uitgezet. Fail-open: bij een queryfout of een
 *  ontbrekend profiel sturen we gewoon, zoals vóór #57. */
async function filterByPreference(
  recipients: string[],
  kind: MessageKind | null,
): Promise<string[]> {
  if (!kind || recipients.length === 0) return recipients;
  const col = PREF_COLUMN[kind];
  const { data } = await supabase
    .from("profiles")
    .select(`id, ${col}`)
    .in("id", recipients);
  const uit = new Set(
    (data ?? [])
      .filter((p) => (p as Record<string, unknown>)[col] === false)
      .map((p) => (p as { id: string }).id),
  );
  return recipients.filter((id) => !uit.has(id));
}

Deno.serve(async (req) => {
  // Fail-closed authenticatie (#459): geen geconfigureerd geheim of een
  // verkeerde/ontbrekende header → weigeren. Voorkomt push-spoofing via de
  // ongeauthenticeerde publieke function-URL.
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Niet toegestaan" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Geen geldige payload" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Eén webhook kan nu meerdere berichten opleveren (#409: winnaars vs.
  // verliezers van een afdroging krijgen elk een eigen tekst).
  const messages = await messagesFor(payload);
  let sent = 0;
  let totalRecipients = 0;
  for (const message of messages) {
    const recipients = await filterByPreference(
      message.recipients,
      message.kind,
    );
    if (recipients.length === 0) continue;
    totalRecipients += recipients.length;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", recipients);

    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({
              title: message.title,
              body: message.body,
              url: message.url,
              tag: message.tag,
            }),
          );
          sent += 1;
        } catch (err) {
          // Verlopen/ingetrokken abonnementen opruimen.
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", s.endpoint);
          }
        }
      }),
    );
  }

  if (totalRecipients === 0) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ sent, recipients: totalRecipients }), {
    headers: { "content-type": "application/json" },
  });
});
