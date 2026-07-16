// Edge Function: verstuurt web-push-meldingen op basis van database-webhooks.
//
// Events (zie ../../snippets/push_webhooks.sql voor de triggers):
//  - INSERT op matches met status != completed  → "Nieuwe ronde" naar de 4 spelers
//  - UPDATE op matches naar status = completed  → "Uitslag ingevoerd" naar de 4 spelers
//  - INSERT op friendships (pending)            → "Vriendschapsverzoek" naar de ontvanger
//  - INSERT/UPDATE op pias_of_week (#203)       → Coach Rudy-sneer naar de pias zelf
//
// Vereiste secrets (supabase secrets set):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
// SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden automatisch meegegeven.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

type RoastIntensiteit = "mild" | "gemeen" | "radioactief";

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
};

type Message = {
  recipients: string[];
  title: string;
  body: string;
  url: string;
};

async function playersOf(match: MatchRecord): Promise<string[]> {
  const { data } = await supabase
    .from("teams")
    .select("player1_id, player2_id")
    .in("id", [match.team_a_id, match.team_b_id]);
  return (data ?? []).flatMap((t) => [t.player1_id, t.player2_id]);
}

async function nameOf(playerId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("username, full_name")
    .eq("id", playerId)
    .maybeSingle();
  return data?.full_name?.trim() || data?.username || "Een speler";
}

// Pias-sneren voor de push (#203), bewust kort genoeg voor een notificatie.
// Toon-conventies en intensiteitsniveaus spiegelen src/features/coach/
// roastTone.ts (plagend over padel en ego, nooit persoonlijk of grof); de
// edge functions delen geen code met src/, dus dit is een eigen compacte set.
const PIAS_SNEER: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Grote favoriet, klein resultaat. Gebeurt de besten. Jou net iets vaker.",
    "De statistieken geloofden in je. De bal duidelijk niet.",
    "Iedereen mag eens verliezen. Alleen deed jij het als torenhoge favoriet.",
    "Kop op: volgende week is er een nieuwe pias. Al ben jij nu wel favoriet.",
    "Je was dé favoriet. Wás. Verleden tijd, net als je vormpeil.",
    "Padel is een teamsport, maar deze titel heb je helemaal zelf verdiend.",
  ],
  gemeen: [
    "De favoriet van de week werd de pias van de week. Poëzie, eigenlijk.",
    "Jij had de hoogste rating op de baan. De baan had daar geen boodschap aan.",
    "Winnen was het minimum. Jij ging vol voor het maximum aan schaamte.",
    "De underdogs danken je hartelijk. Hun hele week is goedgemaakt.",
    "Ik heb je winkans nagerekend. De wiskunde klopte, jij niet.",
    "Zelfs de glazen wand speelde beter mee dan jij.",
  ],
  radioactief: [
    "Dit zet ik in de groepschat. Voor de eeuwigheid.",
    "Zo'n winkans verprutsen hoort in een museum. Vitrine, spotje erop.",
    "De bookmakers zijn failliet aan jou. Je team ook, mentaal.",
    "Choke van de week? Choke van het seizoen, als je het mij vraagt.",
    "Je rating schreef een cheque die je armen niet konden innen.",
    "Ik heb het teruggekeken. Twee keer. Het werd niet beter.",
  ],
};

// Stabiele djb2-hash + deterministische keuze, gekopieerd uit
// src/features/coach/roastTone.ts (roastSeed/seedIndex) zodat een
// webhook-retry dezelfde tekst oplevert.
function roastSeed(...delen: string[]): number {
  let h = 5381;
  const s = delen.join("|");
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return h;
}

function kiesUit(pool: readonly string[], seed: number): string {
  return pool[((seed % pool.length) + pool.length) % pool.length];
}

/** Maandag van de huidige ISO-week als YYYY-MM-DD, in UTC — dezelfde klok
 *  als week_start uit recompute_pias (Postgres draait op UTC). */
function mondayOfCurrentWeek(): string {
  const nu = new Date();
  const maandag = new Date(nu);
  maandag.setUTCDate(nu.getUTCDate() - ((nu.getUTCDay() + 6) % 7));
  return maandag.toISOString().slice(0, 10);
}

async function messageFor(payload: WebhookPayload): Promise<Message | null> {
  if (payload.table === "friendships" && payload.type === "INSERT") {
    const rec = payload.record as {
      requester_id: string;
      addressee_id: string;
      status: string;
    };
    if (rec.status !== "pending") return null;
    return {
      recipients: [rec.addressee_id],
      title: "Nieuw vriendschapsverzoek 🎾",
      body: `${await nameOf(rec.requester_id)} wil met je padellen.`,
      url: "/vrienden",
    };
  }

  if (payload.table === "matches" && payload.type === "INSERT") {
    const rec = payload.record as unknown as MatchRecord;
    // Alleen geplande (gegenereerde) matches; direct gelogde uitslagen niet.
    if (rec.status === "completed") return null;
    return {
      recipients: await playersOf(rec),
      title: "Nieuwe ronde gegenereerd 🎾",
      body: "Jouw match staat klaar — bekijk tegen wie je speelt.",
      url: rec.group_id ? `/groepen/${rec.group_id}` : "/matches",
    };
  }

  if (payload.table === "matches" && payload.type === "UPDATE") {
    const rec = payload.record as unknown as MatchRecord;
    const old = payload.old_record as unknown as MatchRecord | null;
    if (rec.status !== "completed" || old?.status === "completed") return null;
    const score =
      rec.score_a != null && rec.score_b != null
        ? ` ${rec.score_a}–${rec.score_b}`
        : "";
    return {
      recipients: await playersOf(rec),
      title: "Uitslag ingevoerd",
      body: `Jouw match is afgerond:${score}. Bekijk het nieuwe klassement.`,
      url: `/matches/${rec.id}`,
    };
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
      return {
        recipients: (members ?? [])
          .map((m) => m.player_id)
          .filter((id) => id !== rec.created_by),
        title: "Nieuwe speeldag-poll 🎾",
        body: `${await nameOf(rec.created_by)} stelt momenten voor — stem wanneer je kunt.`,
        url: `/groepen/${rec.group_id}?tab=plannen`,
      };
    }

    if (
      payload.type === "UPDATE" &&
      old?.status === "open" &&
      rec.status === "locked" &&
      rec.locked_option_id
    ) {
      const moment = await pollMoment(rec.locked_option_id);
      const voters = await pollVoters(rec.id);
      return {
        recipients: voters,
        title: "Speelmoment gekozen 🎾",
        body: `De groep speelt ${moment}. Kijk of je erbij bent.`,
        url: `/groepen/${rec.group_id}?tab=plannen`,
      };
    }

    if (
      payload.type === "UPDATE" &&
      old?.status !== "booked" &&
      rec.status === "booked" &&
      rec.locked_option_id
    ) {
      const moment = await pollMoment(rec.locked_option_id);
      const yes = await optionYesVoters(rec.locked_option_id);
      return {
        recipients: yes,
        title: "Baan geboekt ✓",
        body: `Jullie spelen ${moment}. Zet het in je agenda!`,
        url: `/groepen/${rec.group_id}?tab=plannen`,
      };
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
    if (rec.week_start !== mondayOfCurrentWeek()) return null;
    if (payload.type === "UPDATE" && old?.player_id === rec.player_id) {
      return null;
    }

    const { data: profiel } = await supabase
      .from("profiles")
      .select("roast_schild, roast_intensiteit")
      .eq("id", rec.player_id)
      .maybeSingle();
    // Schild aan (of profiel weg) → Coach Rudy zwijgt, net als in de feed.
    if (!profiel || profiel.roast_schild) return null;

    const seed = roastSeed(rec.player_id, `${rec.iso_year}-W${rec.iso_week}`);
    const intensiteit = (profiel.roast_intensiteit ?? "gemeen") as RoastIntensiteit;
    return {
      recipients: [rec.player_id],
      title: "🎙️ Coach Rudy heeft iets over je te zeggen…",
      body: `Jij bent de pias van de week. ${kiesUit(PIAS_SNEER[intensiteit], seed)}`,
      url: `/groepen/${rec.group_id}?tab=stand`,
    };
  }

  return null;
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

Deno.serve(async (req) => {
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Geen geldige payload" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const message = await messageFor(payload);
  if (!message || message.recipients.length === 0) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", message.recipients);

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: message.title,
            body: message.body,
            url: message.url,
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

  return new Response(JSON.stringify({ sent, recipients: message.recipients.length }), {
    headers: { "content-type": "application/json" },
  });
});
