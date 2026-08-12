// Edge Function: maakt speeldag-polls zelfsturend. Bedoeld om elk uur door
// pg_cron aangeroepen te worden (zie ../../snippets/poll_deadline_cron.sql).
//
// Drie taken:
// 1. Laatste-kans-push: 24u vóór het eerste kandidaat-moment van een open
//    poll krijgen leden die nog niet stemden één herinnering.
// 2. Auto-sluiten: 12u vóór het eerste moment wordt de best gesteunde,
//    volgens de momentopname haalbare optie vastgelegd (locked); de
//    push_on_poll_update-webhook meldt dat aan de stemmers. Haalt geen enkel
//    moment vier spelers (ja + misschien, #1234), dan wordt de poll
//    geannuleerd — mét een melding aan iedereen die stemde.
// 3. Speeldag-herinnering: enkele uren vóór een vastgelegd/geboekt moment
//    krijgen de ja-stemmers een "vanavond padel"-push.
// 4. Rondes klaarzetten: staat er op de ochtend van de speeldag nog geen
//    enkele ronde, dan zet de cron er zelf een reeks klaar (#827/#846).
//
// De twee eigen pushes (laatste kans, speeldag) lopen via de gedeelde bezorger
// (#1090, ../_shared/meldingenBezorger.ts) en belanden dus ook in de inbox; de
// meldingen bij het locken en boeken komen van de webhook naar send-push.
//
// Deploy ZONDER JWT-verificatie en beveilig met het gedeelde geheim:
//   supabase functions deploy poll-deadline --no-verify-jwt
//   (CRON_SECRET, VAPID_* zijn dezelfde secrets als match-reminders.)

import { createClient } from "npm:@supabase/supabase-js@2";
import { bezorg } from "../_shared/meldingenBezorger.ts";
import { cronGuard } from "../_shared/cronAuth.ts";
import { dagInZone } from "../_shared/klok.ts";
import {
  kiesTitel,
  kiesUit,
  POLL_AFGELAST,
  POLL_LAATSTE_KANS,
  roastSeed,
  SPEELDAG_VANDAAG,
  TITEL_LAATSTE_KANS,
  TITEL_POLL_AFGELAST,
  TITEL_SPEELDAG,
} from "../_shared/roast.ts";
import { kiesMoment } from "../_shared/pollBeslissing.ts";
import {
  magRondesZetten,
  RONDE_MIN,
  rondesVoorDuur,
} from "../_shared/speeldagRondes.ts";
import {
  americanoRound,
  applyRound,
  emptyHistory,
} from "../_shared/americano.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CRON_SECRET = Deno.env.get("CRON_SECRET");
/** Uren vóór het eerste moment waarop de laatste-kans-push vertrekt. */
const LAST_CALL_HOURS = Number(Deno.env.get("POLL_LAST_CALL_HOURS") ?? "24");
/** Uren vóór het eerste moment waarop de poll automatisch sluit. */
const AUTO_LOCK_HOURS = Number(Deno.env.get("POLL_AUTO_LOCK_HOURS") ?? "12");
/** Uren vóór het vastgelegde moment voor de speeldag-herinnering. */
const DAY_OF_HOURS = Number(Deno.env.get("POLL_DAY_OF_HOURS") ?? "5");
/** Klokuur (clubtijd) op de speeldag zelf vanaf wanneer de cron de rondes van
 *  een geboekte speeldag klaarzet (#846). 's Ochtends, zodat de indeling de
 *  hele dag zichtbaar is en spelers ruim de tijd hebben om een lef-tip te
 *  plaatsen. Eerste tik daarna is 08:05, want de cron loopt op :05. */
const ROUNDS_AT = Deno.env.get("POLL_ROUNDS_AT") ?? "08:00";
/** Vangnet voor speeldagen die vóór dat uur beginnen: dan alsnog vlak vóór de
 *  start. Ruim een uur, want de cron tikt maar één keer per uur — met een
 *  krapper venster zou een speeldag die net tussen twee tikken start ernaast
 *  vallen. */
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
  // wil niet dat de cron er ongevraagd rondes bij zet. De rondes van die dag
  // zoeken we op played_at; een groep kan al ver vóór de speeldag zelf hebben
  // ingedeeld, dus een venster op created_at zou die missen. Rondes van vóór
  // #832 hebben geen played_at — die vallen terug op hun aanmaakdag.
  const dagStart = new Date(clubEpoch(locked.date, "00:00", tz)).toISOString();
  const dagEinde = new Date(
    clubEpoch(locked.date, "00:00", tz) + 24 * 3600_000,
  ).toISOString();
  const { data: bestaand } = await admin
    .from("matches")
    .select("played_at, created_at, round_number")
    .eq("group_id", poll.group_id)
    .not("round_number", "is", null)
    .or(
      `and(played_at.gte.${dagStart},played_at.lt.${dagEinde}),` +
        `and(played_at.is.null,created_at.gte.${dagStart},created_at.lt.${dagEinde})`,
    );
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
    /** Unieke stemmers met deze status op dit moment. De PK is (option_id,
     *  player_id), dus de set is een gordel bij de riem. */
    const aantalOp = (optionId: string, status: "yes" | "maybe") =>
      new Set(
        allVotes
          .filter((v) => v.option_id === optionId && v.status === status)
          .map((v) => v.player_id),
      ).size;

    const tz = poll.club_timezone ?? TIME_ZONE;
    if (poll.status === "open") {
      // Verlopen (#440/#445): álle momenten voorbij → stil annuleren zodat de
      // rij niet eeuwig als 'open' blijft staan. Geen push (send-push heeft
      // geen cancelled-tak, en de melding uit #1234 hangt aan de drempel, niet
      // aan de status); de hoofdquery filtert cancelled er nadien uit.
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
        // Tekst en titel uit een pool (#189): deze push ging altijd woord voor
        // woord hetzelfde de deur uit. Geseed op de poll, zodat één poll bij
        // elke ontvanger dezelfde regel krijgt (het is één groepsmelding).
        result.lastCall += (await bezorg(admin, [{
          recipients: silent,
          title: kiesTitel(TITEL_LAATSTE_KANS, poll.id),
          body: kiesUit(POLL_LAATSTE_KANS, roastSeed(poll.id, "laatste-kans")),
          url: `/speeldag/${poll.id}`,
          soort: "poll",
          tag: `poll-${poll.id}`,
        }])).sent;
        await admin
          .from("play_polls")
          .update({ deadline_notified_at: new Date().toISOString() })
          .eq("id", poll.id);
      }

      // 2) Auto-sluiten: beste haalbare optie vastleggen, of annuleren als
      //    geen enkel moment vier spelers haalt (#1234).
      if (first - now <= AUTO_LOCK_HOURS * 3600_000) {
        const gekozen = kiesMoment(opts.map((o) => ({
          optionId: o.id,
          ja: aantalOp(o.id, "yes"),
          misschien: aantalOp(o.id, "maybe"),
          courtsFree: o.courts_free,
          startMs: clubEpoch(o.date, o.start_time, tz),
        })));
        if (gekozen) {
          await admin
            .from("play_polls")
            .update({ status: "locked", locked_option_id: gekozen.optionId })
            .eq("id", poll.id);
          result.locked += 1; // push volgt via de update-webhook
        } else {
          await admin
            .from("play_polls")
            .update({ status: "cancelled" })
            .eq("id", poll.id);
          result.cancelled += 1;
          // Dit is de énige annulering die iets meldt. De twee verval-takken
          // hierboven en hieronder zwijgen bewust: daar is de speeldag stil
          // langs iedereen heen gegleden, hier is er een beslissing genomen.
          // Uit de cron en niet via de webhook naar send-push, want alleen
          // hier is de reden bekend — een cancelled-tak daar zou ook bij een
          // verlopen of handmatig geannuleerde poll afgaan.
          await bezorg(admin, [{
            recipients: [...new Set(allVotes.map((v) => v.player_id))],
            title: kiesTitel(TITEL_POLL_AFGELAST, poll.id),
            body: `Te weinig spelers voor een baan. ${
              kiesUit(POLL_AFGELAST, roastSeed(poll.id, "afgelast"))
            }`,
            url: `/speeldag/${poll.id}`,
            soort: "poll",
            tag: `poll-${poll.id}`,
          }]);
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
    //    de beurt komen. Geboekt én de ochtend van de speeldag (#846), niet
    //    pas vlak vóór de start.
    if (
      magRondesZetten({
        status: poll.status,
        rondesGezetOp: poll.rounds_generated_at,
        now,
        start,
        ochtend: clubEpoch(locked.date, ROUNDS_AT, tz),
        leadMin: ROUNDS_LEAD_MIN,
      })
    ) {
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
      result.dayOf += (await bezorg(admin, [{
        recipients: players,
        title: kiesTitel(TITEL_SPEELDAG, poll.id),
        body:
          `Jullie spelen om ${locked.start_time}` +
          (geboekt ? " — baan geboekt ✓" : " — vergeet de baan niet te boeken") +
          (code ? ` · code ${code}` : "") +
          `. ${kiesUit(SPEELDAG_VANDAAG, roastSeed(poll.id, "speeldag"))}`,
        url: `/speeldag/${poll.id}`,
        // Bewust 'poll' en niet 'speeldag_herinnering': deze melding hangt aan
        // de poll (zelfde tag, zelfde link) en had vóór #1090 geen enkele
        // voorkeurfilter. 'speeldag_herinnering' zou hem stil onder
        // notify_match_reminder schuiven.
        soort: "poll",
        tag: `poll-${poll.id}`,
      }])).sent;
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
