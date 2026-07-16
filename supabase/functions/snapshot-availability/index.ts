// Edge Function: snapshot de Playtomic-baanbeschikbaarheid van de thuisclub
// naar public.court_availability_snapshots (#405). Bedoeld om door pg_cron
// aangeroepen te worden (zie ../../snippets/availability_snapshot_cron.sql):
// vandaag+morgen elke 15 min, de volle week elk uur. Zo is het upstream-
// verkeer constant en laag — losgekoppeld van het aantal bezoekers — en
// blijft /banen bruikbaar bij korte Playtomic-uitval (laatste snapshot).
//
// Bewust terughoudend richting Playtomic: één club, dagen sequentieel met
// een korte pauze, en géén retries — een mislukte dag laat gewoon de vorige
// snapshot staan tot de volgende cron-tik.
//
// Deploy ZONDER JWT-verificatie en beveilig met het gedeelde geheim:
//   supabase functions deploy snapshot-availability --no-verify-jwt
//   (CRON_SECRET is dezelfde secret als match-reminders/poll-deadline;
//    optioneel SNAPSHOT_TENANT_ID voor een andere thuisclub.)

import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Zelfde upstream en headers als playtomic-availability (de egress-hop van de
// live-route); geen User-Agent, net als daar.
const UPSTREAM = "https://playtomic.com/api/clubs/availability";

// Thuisclub: LAGO CLUB Padel Beveren (DEFAULT_CLUB in
// src/features/availability/club.ts). Alléén deze club snapshotten —
// meer clubs vergroot juist de voetafdruk die we willen beperken.
const TENANT_ID =
  Deno.env.get("SNAPSHOT_TENANT_ID") ?? "91d8d419-3736-498e-90be-362de786d588";

// Clubtijdzone: "vandaag" moet de clubdag zijn, niet de UTC-dag van Deno.
const TIME_ZONE = "Europe/Brussels";

/** Vandaag ("YYYY-MM-DD") in clubtijd; en-CA formatteert als ISO-datum. */
function todayInClubTime(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
    new Date(),
  );
}

/** "YYYY-MM-DD" + n dagen, DST-proof via UTC-middag. */
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Geen toegang" }), {
      status: 401,
    });
  }

  // Aantal dagen vanaf vandaag; de cron stuurt {"days":2} (vers) of
  // {"days":7} (weeksweep). Clamp zodat een vreemde body nooit een burst
  // richting Playtomic wordt.
  let days = 7;
  try {
    const body = await req.json();
    if (typeof body?.days === "number") {
      days = Math.min(7, Math.max(1, Math.trunc(body.days)));
    }
  } catch {
    // Geen/ongeldige JSON-body: hou de default van 7 dagen aan.
  }

  const today = todayInClubTime();
  const result = { ok: 0, failed: 0, days };

  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    if (i > 0) await pause(300); // sequentieel, geen burst
    try {
      const upstream = await fetch(
        `${UPSTREAM}?tenant_id=${TENANT_ID}&date=${date}&sport_id=PADEL`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8",
          },
        },
      );
      if (!upstream.ok) {
        // Geen retry: de vorige snapshot van deze dag blijft gewoon staan.
        result.failed += 1;
        continue;
      }
      const payload = await upstream.json();
      const { error } = await admin.from("court_availability_snapshots").upsert(
        {
          tenant_id: TENANT_ID,
          date,
          payload,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,date" },
      );
      if (error) throw error;
      result.ok += 1;
    } catch (err) {
      console.error(`snapshot ${date} mislukt:`, err);
      result.failed += 1;
    }
  }

  // Verleden opruimen; 1 dag marge tegen tijdzoneranden (de tabel is klein,
  // dit is puur hygiëne).
  await admin
    .from("court_availability_snapshots")
    .delete()
    .lt("date", addDays(today, -1));

  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
});
