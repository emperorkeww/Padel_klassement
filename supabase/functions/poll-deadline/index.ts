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
//
// Deploy ZONDER JWT-verificatie en beveilig met het gedeelde geheim:
//   supabase functions deploy poll-deadline --no-verify-jwt
//   (CRON_SECRET, VAPID_* zijn dezelfde secrets als match-reminders.)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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
  club_timezone: string | null;
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

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 401 });
  }

  const now = Date.now();
  const result = { lastCall: 0, locked: 0, cancelled: 0, dayOf: 0 };

  const { data: polls } = await admin
    .from("play_polls")
    .select("id, group_id, status, locked_option_id, deadline_notified_at, dayof_notified_at, club_timezone")
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

    if (poll.dayof_notified_at) continue;
    const start = clubEpoch(locked.date, locked.start_time, tz);
    if (start > now && start - now <= DAY_OF_HOURS * 3600_000) {
      const players = [...new Set(yesOn(locked.id).map((v) => v.player_id))];
      result.dayOf += await pushTo(players, {
        title: "Vandaag padel 🎾",
        body: `Jullie spelen om ${locked.start_time}${poll.status === "booked" ? " — baan geboekt ✓" : " — vergeet de baan niet te boeken"}.`,
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
