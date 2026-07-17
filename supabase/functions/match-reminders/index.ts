// Edge Function: stuurt X uur vóór een geplande match een push naar de 4 spelers.
// Bedoeld om periodiek door pg_cron aangeroepen te worden (zie
// ../../snippets/match_reminder_cron.sql). Elke match krijgt hooguit één
// herinnering: verzonden matches worden in public.match_reminders bijgehouden.
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

const REMINDER_HOURS = Number(Deno.env.get("REMINDER_HOURS") ?? "3");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

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

/** Notificatie-voorkeuren (#57): laat alleen spelers over die
 *  match-herinneringen niet hebben uitgezet. Fail-open: bij een queryfout of
 *  een ontbrekend profiel sturen we gewoon, zoals vóór #57. */
async function withReminderPref(recipients: string[]): Promise<string[]> {
  if (recipients.length === 0) return recipients;
  const { data } = await admin
    .from("profiles")
    .select("id, notify_match_reminder")
    .in("id", recipients);
  const uit = new Set(
    (data ?? []).filter((p) => p.notify_match_reminder === false).map((p) => p.id),
  );
  return recipients.filter((id) => !uit.has(id));
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

Deno.serve(async (req) => {
  // Alleen aanroepbaar met het juiste cron-geheim.
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Niet toegestaan" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

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

  let reminded = 0;
  let sent = 0;
  for (const m of (matches ?? []) as MatchRow[]) {
    if (done.has(m.id)) continue;
    const players = await withReminderPref(await playersOf(m));
    const when = new Date(m.played_at);
    const time = when.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
    sent += await pushTo(players, {
      title: "Je match begint bijna 🎾",
      body: `Om ${time} sta je op de baan. Succes!`,
      url: m.group_id ? `/groepen/${m.group_id}` : `/matches/${m.id}`,
    });
    await admin.from("match_reminders").insert({ match_id: m.id });
    reminded += 1;
  }

  return new Response(JSON.stringify({ reminded, sent }), {
    headers: { "content-type": "application/json" },
  });
});
