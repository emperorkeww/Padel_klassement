// Edge Function: maakt speeldag-polls zelfsturend. Bedoeld om elk uur door
// pg_cron aangeroepen te worden (zie ../../snippets/poll_deadline_cron.sql).
//
// Drie taken:
// 1. Laatste-kans-push: 24u vóór het eerste kandidaat-moment van een open
//    poll krijgen leden die nog niet stemden één herinnering.
// 2. Auto-sluiten: 12u vóór het eerste moment wordt de best gesteunde,
//    volgens de momentopname haalbare optie vastgelegd (locked); de
//    push_on_poll_update-webhook meldt dat aan de stemmers. Zonder één
//    enkele ja-stem wordt de poll geannuleerd.
// 3. Speeldag-herinnering: enkele uren vóór een vastgelegd/geboekt moment
//    krijgen de ja-stemmers een "vanavond padel"-push.
// 4. Rondes klaarzetten: staat er kort vóór de start nog geen enkele ronde
//    voor die speeldag, dan zet de cron er zelf een reeks klaar (#827).
//
// Deploy ZONDER JWT-verificatie en beveilig met het gedeelde geheim:
//   supabase functions deploy poll-deadline --no-verify-jwt
//   (CRON_SECRET, VAPID_* zijn dezelfde secrets als match-reminders.)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { cronGuard } from "../_shared/cronAuth.ts";
import { dagInZone } from "../_shared/klok.ts";
import { RONDE_MIN, rondesVoorDuur } from "../_shared/speeldagRondes.ts";
import {
  americanoRound,
  applyRound,
  emptyHistory,
} from "../_shared/americano.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:beheer@vamos.example",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const CRON_SECRET = Deno.env.get("CRON_SECRET");
/** Uren vóór het eerste moment waarop de laatste-kans-push vertrekt. */
const LAST_CALL_HOURS = Number(Deno.env.get("POLL_LAST_CALL_HOURS") ?? "24");
/** Uren vóór het eerste moment waarop de poll automatisch sluit. */
const AUTO_LOCK_HOURS = Number(Deno.env.get("POLL_AUTO_LOCK_HOURS") ?? "12");
/** Uren vóór het vastgelegde moment voor de speeldag-herinnering. */
const DAY_OF_HOURS = Number(Deno.env.get("POLL_DAY_OF_HOURS") ?? "5");
/** Minuten vóór de start waarbinnen de cron zelf rondes klaarzet (#827).
 *  Ruim een uur, want de cron tikt maar één keer per uur (op :05): met een
 *  krapper venster zou een speeldag die net tussen twee tikken start ernaast
 *  vallen. Het laat bovendien nog even ruimte om een lef-tip te plaatsen, die
 *  op de starttijd van de match sluit. */
const ROUNDS_LEAD_MIN = Number(Deno.env.get("POLL_ROUNDS_LEAD_MIN") ?? "90");

// Fallback-clubtijd voor polls van vóór #322 (die nog geen club_timezone hebben).
const TIME_ZONE = "Europe/Brussels"; // zie availability/club.ts

/** Epoch (ms) van "YYYY-MM-DD" + "HH:MM" in clubtijd, DST-proof. De tijdzone
 *  komt van de poll (#322), zodat clubs buiten Brussel juist gepland worden.
 *  Gespiegeld in src/lib/utils/time.ts (#440). */
function clubEpoch(date: string, time: string, timeZone = TIME_ZONE): number {
  const naive = new Date(`${date}T${time}:00Z`).getTime();
  // Offset van de clubtijdzone op dat moment bepalen via Intl.
  const inZone = new Date(
    new Date(naive).toLocaleString("en-US", { timeZone }),
  ).getTime();
  const utc = new Date(
    new Date(naive).toLocaleString("en-US", { timeZone: "UTC" }),
  ).getTime();
  return naive - (inZone - utc);
}

async function pushTo(recipients: string[], payload: unknown): Promise<number> {
  if (recipients.length === 0) return 0;
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", recipients);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }),
  );
  return sent;
}

type PollRow = {
  id: string;
  group_id: string;
  status: string;
  locked_option_id: string | null;
  deadline_notified_at: string | null;
  dayof_notified_at: string | null;
  rounds_generated_at: string | null;
  club_timezone: string | null;
  access_code: string | null;
  created_by: string;
};
type OptionRow = {
  id: string;
  poll_id: string;
  date: string;
  start_time: string;
  duration: number;
  courts_free: number | null;
};

/** Marge na afloop van het slot voordat een moment als verlopen telt (#440).
 *  Gespiegeld in src/features/groups/pollLogic.ts. */
const SLOT_EXPIRY_MARGIN_MIN = 30;

/** Epoch (ms, clubtijd) waarop een optie verlopen is: slot-einde plus marge. */
function optionEndMs(o: OptionRow, timeZone: string): number {
  return (
    clubEpoch(o.date, o.start_time, timeZone) +
    (o.duration + SLOT_EXPIRY_MARGIN_MIN) * 60_000
  );
}

function fmtMoment(o: OptionRow): string {
  const day = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${o.date}T12:00:00`));
  return `${day} om ${o.start_time}`;
}

/**
 * Zet de rondes van een speeldag klaar (#827) als er nog geen enkele staat.
 * Americano: partners én tegenstanders wisselen over de avond, en wie al het
 * meest speelde rust als eerste. De historie begint leeg en groeit per ronde
 * mee — er staat immers per definitie nog niets voor die dag.
 *
 * Geeft het aantal aangemaakte rondes terug (0 = niets gedaan).
 */
async function zetRondesKlaar(
  poll: PollRow,
  locked: OptionRow,
  start: number,
  tz: string,
  bevestigd: string[],
): Promise<number> {
  // Minder dan één volle baan: daar valt niets in te delen.
  if (bevestigd.length < 4) return 0;

  // Ontsnappingsluik per groep.
  const { data: groep } = await admin
    .from("groups")
    .select("auto_rondes")
    .eq("id", poll.group_id)
    .maybeSingle();
  if (groep && groep.auto_rondes === false) return 0;

  // Staat er al iets voor deze speeldag, dan met rust laten — wie zelf indeelt
  // wil niet dat de cron er ongevraagd rondes bij zet. Het venster van 36 uur
  // houdt de query klein; verder terug kan geen ronde van vandaag zijn.
  const vanaf = new Date(start - 36 * 3600_000).toISOString();
  const { data: bestaand } = await admin
    .from("matches")
    .select("played_at, created_at, round_number")
    .eq("group_id", poll.group_id)
    .not("round_number", "is", null)
    .gte("created_at", vanaf);
  const alBezet = (bestaand ?? []).some(
    (m) => dagInZone(m.played_at ?? m.created_at, tz) === locked.date,
  );
  if (alBezet) return 0;

  const aantal = rondesVoorDuur(locked.duration);
  // De historie draagt de partner-, tegenstander- en bankbeurten mee, zodat
  // de rondes onderling variëren in plaats van elkaar te herhalen.
  const historie = emptyHistory();
  let gemaakt = 0;
  for (let i = 0; i < aantal; i++) {
    const { courts } = americanoRound(bevestigd, historie);
    if (courts.length === 0) break;
    applyRound(historie, courts);

    const { error } = await admin.rpc("create_fair_round", {
      p_group_id: poll.group_id,
      // Per baan vier op een rij: team A eerst, dan team B — de vorm die
      // create_fair_round verwacht. De indeling komt van Americano, de RPC
      // schrijft alleen weg wat hij krijgt.
      p_players: courts.flatMap((c) => [...c.teamA, ...c.teamB]),
      p_played_at: new Date(start + i * RONDE_MIN * 60_000).toISOString(),
      // De cron heeft geen auth.uid(); de maker van de speeldag is de
      // natuurlijke eigenaar van wat er uit die speeldag volgt.
      p_created_by: poll.created_by,
    });
    if (error) {
      // Stoppen met deze speeldag. Ging het bij de eerste ronde al mis, dan is
      // er niets aangemaakt en probeert de volgende tik het opnieuw. Lukte er
      // al één, dan houdt de al-bezet-check hierboven de cron voortaan tegen:
      // liever een halve reeks die de groep zelf aanvult dan dubbele rondes.
      console.error("auto-rondes mislukt", poll.id, error.message);
      break;
    }
    gemaakt += 1;
  }

  if (gemaakt > 0) {
    await admin
      .from("play_polls")
      .update({ rounds_generated_at: new Date().toISOString() })
      .eq("id", poll.id);
  }
  return gemaakt;
}

Deno.serve(async (req) => {
  // Fail-closed cron-guard (#460).
  const denied = cronGuard(req, CRON_SECRET);
  if (denied) return denied;

  const now = Date.now();
  const result = { lastCall: 0, locked: 0, cancelled: 0, dayOf: 0, rondes: 0 };

  const { data: polls } = await admin
    .from("play_polls")
    .select("id, group_id, status, locked_option_id, deadline_notified_at, dayof_notified_at, rounds_generated_at, club_timezone, access_code, created_by")
    .in("status", ["open", "locked", "booked"]);

  for (const poll of (polls ?? []) as PollRow[]) {
    const { data: options } = await admin
      .from("play_poll_options")
      .select("id, poll_id, date, start_time, duration, courts_free")
      .eq("poll_id", poll.id);
    const opts = (options ?? []) as OptionRow[];
    if (opts.length === 0) continue;

    const { data: votes } = await admin
      .from("play_poll_votes")
      .select("option_id, player_id, status")
      .in("option_id", opts.map((o) => o.id));
    const allVotes = votes ?? [];
    const yesOn = (optionId: string) =>
      allVotes.filter((v) => v.option_id === optionId && v.status === "yes");

    const tz = poll.club_timezone ?? TIME_ZONE;
    if (poll.status === "open") {
      // Verlopen (#440/#445): álle momenten voorbij → stil annuleren zodat de
      // rij niet eeuwig als 'open' blijft staan. Geen push (send-push heeft
      // geen cancelled-tak); de hoofdquery filtert cancelled er nadien uit.
      if (opts.every((o) => optionEndMs(o, tz) <= now)) {
        await admin
          .from("play_polls")
          .update({ status: "cancelled" })
          .eq("id", poll.id);
        result.cancelled += 1;
        continue;
      }

      const first = Math.min(...opts.map((o) => clubEpoch(o.date, o.start_time, tz)));
      if (first <= now) continue; // eerste moment al voorbij: laten rusten

      // 1) Laatste kans voor wie nog niet stemde.
      if (
        !poll.deadline_notified_at &&
        first - now <= LAST_CALL_HOURS * 3600_000
      ) {
        const { data: members } = await admin
          .from("group_members")
          .select("player_id")
          .eq("group_id", poll.group_id);
        const voted = new Set(allVotes.map((v) => v.player_id));
        const silent = (members ?? [])
          .map((m) => m.player_id)
          .filter((id) => !voted.has(id));
        result.lastCall += await pushTo(silent, {
          title: "Laatste kans om te stemmen ⏳",
          body: "De speeldag-poll sluit binnenkort — laat weten wanneer je kunt.",
          url: `/groepen/${poll.group_id}?tab=plannen`,
        });
        await admin
          .from("play_polls")
          .update({ deadline_notified_at: new Date().toISOString() })
          .eq("id", poll.id);
      }

      // 2) Auto-sluiten: beste haalbare optie vastleggen.
      if (first - now <= AUTO_LOCK_HOURS * 3600_000) {
        const candidates = opts
          .map((o) => ({ o, yes: yesOn(o.id).length }))
          .filter(({ o, yes }) => {
            if (yes === 0) return false;
            const needed = Math.max(1, Math.ceil(yes / 4));
            return o.courts_free == null || o.courts_free >= needed;
          })
          .sort((a, b) => b.yes - a.yes);
        if (candidates.length > 0) {
          await admin
            .from("play_polls")
            .update({ status: "locked", locked_option_id: candidates[0].o.id })
            .eq("id", poll.id);
          result.locked += 1; // push volgt via de update-webhook
        } else {
          await admin
            .from("play_polls")
            .update({ status: "cancelled" })
            .eq("id", poll.id);
          result.cancelled += 1;
        }
      }
      continue;
    }

    // 3) Speeldag-herinnering voor gelockte/geboekte polls.
    const locked = opts.find((o) => o.id === poll.locked_option_id);
    if (!locked) continue;

    // Verlopen (#445): een gelockte-maar-nooit-geboekte poll waarvan het
    // gekozen moment voorbij is → stil annuleren. 'booked' laten we staan:
    // dat is een echt geboekte avond, geen data-ruis.
    if (poll.status === "locked" && optionEndMs(locked, tz) <= now) {
      await admin
        .from("play_polls")
        .update({ status: "cancelled" })
        .eq("id", poll.id);
      result.cancelled += 1;
      continue;
    }

    const start = clubEpoch(locked.date, locked.start_time, tz);

    // 4) Rondes klaarzetten (#827). Staat vóór de dayof-dedup hieronder: de
    //    speeldag-push vertrekt uren eerder, en anders zou deze tak nooit aan
    //    de beurt komen.
    if (!poll.rounds_generated_at && start > now &&
        start - now <= ROUNDS_LEAD_MIN * 60_000) {
      const bevestigd = [...new Set(yesOn(locked.id).map((v) => v.player_id))];
      result.rondes += await zetRondesKlaar(poll, locked, start, tz, bevestigd);
    }

    if (poll.dayof_notified_at) continue;
    if (start > now && start - now <= DAY_OF_HOURS * 3600_000) {
      const players = [...new Set(yesOn(locked.id).map((v) => v.player_id))];
      // Toegangscode mee in de herinnering (#675): dit is exact het moment
      // waarop je hem nodig hebt, en het scheelt het zoekwerk in de groepschat.
      // Alleen bij een geboekte baan — een code zonder boeking zegt niets.
      const geboekt = poll.status === "booked";
      const code = geboekt ? poll.access_code : null;
      result.dayOf += await pushTo(players, {
        title: "Vandaag padel 🎾",
        body:
          `Jullie spelen om ${locked.start_time}` +
          (geboekt ? " — baan geboekt ✓" : " — vergeet de baan niet te boeken") +
          (code ? ` · code ${code}` : "") +
          ".",
        url: `/groepen/${poll.group_id}?tab=plannen`,
      });
      await admin
        .from("play_polls")
        .update({ dayof_notified_at: new Date().toISOString() })
        .eq("id", poll.id);
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
});
