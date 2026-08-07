import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/ui/ToastProvider";
import { Avatar } from "@/ui/Avatar";
import { errorMessage } from "@/lib/utils/errors";
import { fairTeams } from "@/features/groups/fairTeamsLogic";
import { downloadSpeeldagIcs } from "@/features/groups/speeldagIcs";
import { bookingUrl } from "@/features/availability/api";
import { useBookingUrl } from "@/features/availability/useBookingUrl";
import { shareOrCopyText } from "@/lib/utils/shareText";
import { displayName } from "@/features/profiles/api";
import {
  markPollBooked,
  pollShareUrl,
  setPollBookingDetails,
  type BookingDetails,
  type PlayPoll,
  type PollOption,
} from "@/features/groups/pollsApi";
import { BookingSheet } from "./BookingSheet";
import { ShareSpeeldag } from "./ShareSpeeldag";
import type { OptionTally } from "@/features/groups/pollLogic";
import { createFairRound } from "@/features/groups/api";
import { rondeStart } from "@/features/groups/speeldagRondes";
import { getPlayerRatings } from "@/features/standings/ratingsApi";
import { isPlaytomicClub, type Club } from "@/features/availability/club";
import type { Profile } from "@/types";
import { courtsLabel, longDay, shortDay } from "../planPollHelpers";

/* ------------------------------------------------------------------ */
/* Winner-card: het gekozen/geboekte moment met boeken, agenda, delen  */
/* en het klaarzetten van eerlijke rondes.                             */
/* ------------------------------------------------------------------ */

/** Rondes die je in één keer kunt klaarzetten (#727). Tien is ruim boven een
 *  normale speelavond; meer is eerder een vergissing dan een wens. */
const RONDE_KEUZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function WinnerCard({
  poll,
  option: o,
  tally: t,
  perPerson: pp,
  club,
  groupName,
  profiles,
  isManager,
  busy,
  run,
  roundsExist = false,
  rondesVandaag = 0,
  onRoundsMade,
}: {
  poll: PlayPoll;
  option: PollOption;
  tally: OptionTally;
  perPerson: string | null;
  club: Club;
  groupName: string;
  profiles: Record<string, Profile>;
  isManager: boolean;
  busy: boolean;
  run: (fn: () => Promise<void>, done?: string) => Promise<void>;
  /** Er bestaan al rondes voor deze speeldag (uit de groep-matches, #349). */
  roundsExist?: boolean;
  /** Rondes die op de dag van dit moment al klaarstaan: het vertrekpunt voor
   *  de starttijden van de volgende rondes (#827). */
  rondesVandaag?: number;
  /** Rondes klaargezet — laat de tab-fasebalk meteen naar Klaar springen. */
  onRoundsMade?: () => void;
}) {
  const toast = useToast();
  const name = (id: string) => displayName(profiles[id]);
  const canBook = isPlaytomicClub(club);
  const bookHref = useBookingUrl(club, o.date);

  // Eén of meer rondes al gegenereerd vanuit deze kaart (sessie-lokaal);
  // roundsExist dekt rondes die elders (of eerder) zijn klaargezet.
  const [roundsMade, setRoundsMade] = useState(0);
  const roundsDone = roundsExist || roundsMade > 0;
  // Hoeveel rondes deze tik klaarzet (#727): een hele avond vooruit plannen
  // kostte evenveel tikken als rondes.
  const [rondes, setRondes] = useState(1);
  /** Volle banen bij de huidige bevestigingen — één match per baan per ronde. */
  const banen = Math.floor(t.yes.length / 4);

  // Boekgegevens-sheet (#675, #802). "boeken" hangt banen en code aan de
  // boekstap vast, "wijzigen" zet ze los achteraf — die gegevens komen vaak pas
  // met de bevestigingsmail. null = sheet dicht.
  const [boekSheet, setBoekSheet] = useState<"boeken" | "wijzigen" | null>(null);
  const code = poll.access_code;
  const banenGeboekt = poll.courts;

  function submitBooking(details: BookingDetails) {
    const mode = boekSheet;
    setBoekSheet(null);
    if (mode === "boeken") {
      void run(() => markPollBooked(poll.id, details), "Speeldag geboekt ✓");
      return;
    }
    void run(
      () => setPollBookingDetails(poll.id, details),
      details.courts || details.accessCode
        ? "Boekgegevens opgeslagen."
        : "Boekgegevens gewist.",
    );
  }

  /** Tik op de code = naar het klembord: je staat met je telefoon bij de deur. */
  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code gekopieerd.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function exportIcs() {
    // De banen (#802) en de toegangscode (#675) horen juist hier: op het moment
    // dat je ze nodig hebt staan ze al in je agenda, zonder de app te openen.
    // Een ICS is een persoonlijke download, geen deelbare poster — dus geen
    // opt-in nodig.
    //
    // Sinds #1121 via dezelfde helper als de agenda en als "haal uit je
    // agenda". Deze kaart bouwde een eigen event met een eigen UID, waardoor
    // een annulering het item dat je hier ophaalde nooit wiste — twee events
    // over dezelfde speeldag, waarvan er één bleef staan.
    downloadSpeeldagIcs({
      pollId: poll.id,
      groupName,
      clubName: club.name,
      date: o.date,
      startTime: o.start_time,
      duration: o.duration,
      courts: banenGeboekt,
      accessCode: code,
      deelnemers: t.yes.map(name),
      changedAt: poll.booked_at ?? poll.locked_at ?? poll.created_at,
    });
  }

  /** Deeltekst voor de groepschat: het vastgelegde moment + deelnemers. */
  async function shareWinner() {
    const lines = [
      `🎾 Padel — ${groupName}`,
      `📅 ${longDay(o.date)} om ${o.start_time} (${o.duration} min)`,
      `📍 ${club.name}${pp ? ` · ± ${pp} p.p.` : ""}`,
      t.yes.length > 0
        ? `👥 Doet mee: ${t.yes.map(name).join(", ")}`
        : "👥 Nog geen bevestigde deelnemers — stem mee in de app!",
      poll.status === "booked"
        ? // Staat de baan erbij (#802)? Dan meteen in dezelfde regel: dat is
          // precies wat er nu in de groepschat nagevraagd wordt.
          banenGeboekt != null
          ? `✅ Geboekt — ${courtsLabel(banenGeboekt)} — tot dan!`
          : "✅ Baan geboekt — tot dan!"
        : canBook
          ? `⏳ Baan nog boeken: ${await bookingUrl(club, o.date)}`
          : "⏳ Baan nog boeken.",
      // De code hoort juist wél in de groepschat-tekst (#675): dat is precies
      // waar mensen 'm nu handmatig overtikken. Anders dan bij de poster is
      // hier geen opt-in nodig — je ziet de tekst vóór je 'm verstuurt.
      ...(code != null ? [`🔑 Code velden: ${code}`] : []),
    ];
    try {
      const outcome = await shareOrCopyText({
        title: `Padel ${shortDay(o.date)}`,
        text: lines.join("\n"),
        // Deep-link naar déze speeldag (#675) — als los url-veld, zodat het
        // deelvenster er een nette preview van maakt en het klembord 'm onder
        // de tekst zet. Alleen bruikbaar voor groepsleden; dat is de bedoeling.
        url: pollShareUrl(poll.id),
      });
      if (outcome === "clipboard") toast.success("Tekst gekopieerd naar klembord.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(errorMessage(err));
    }
  }

  /**
   * Zet eerlijke rondes klaar met de ja-stemmers van het gekozen moment
   * (Elo-gebalanceerd via create_fair_round). Expliciete actie: de gebruiker
   * kiest zelf wanneer — zodra de datum vastligt en genoeg mensen bevestigden.
   */
  function generateRounds() {
    return run(async () => {
      const ratings = await getPlayerRatings();
      let total = 0;
      // Eén serverronde per gevraagde ronde, met een oplopende `variant`:
      // precies wat herhaald op "Nog een ronde" tikken deed, maar in één
      // handeling (#727). Zo krijgt elke ronde een eigen indeling.
      for (let i = 0; i < rondes; i++) {
        const teams = fairTeams(t.yes, ratings, roundsMade + i);
        const courts = teams.courts.map((c) => ({
          teamA: c.teamA.playerIds,
          teamB: c.teamB.playerIds,
        }));
        if (courts.length === 0) {
          if (total === 0) throw new Error("Geen volledige banen te vullen.");
          break;
        }
        // Elke ronde krijgt de echte starttijd van de speeldag mee, tien
        // minuten per ronde opschuivend (#827) — anders staan alle rondes op
        // hetzelfde moment en valt de app terug op created_at.
        const playedAt = rondeStart(
          o,
          poll.club_timezone ?? club.timezone,
          rondesVandaag + roundsMade + i,
        );
        const ids = await createFairRound(poll.group_id, courts, playedAt);
        total += ids.length;
      }
      setRoundsMade((n) => n + rondes);
      onRoundsMade?.();
      toast.success(
        total === 1
          ? "Eerlijke match klaargezet — zie Vandaag."
          : `${total} eerlijke matches klaargezet — zie Vandaag.`,
      );
    });
  }

  return (
    <li className="winner-card">
      {/* Kop: baangroene band met het moment + status. */}
      <div className="winner-card__head">
        <span className="winner-card__when">
          🎾 {longDay(o.date)} · {o.start_time}
        </span>
        <span className="winner-card__status">
          {poll.status === "booked" ? "Geboekt ✓" : "Gekozen"}
        </span>
      </div>

      <div className="winner-card__body">
        <p className="winner-card__meta">
          {o.duration} min · {club.name}
          {pp ? ` · ± ${pp} p.p.` : ""}
        </p>

        <div className="winner-card__players">
          {t.yes.slice(0, 6).map((pid) => (
            <Avatar key={pid} profile={profiles[pid]} size={26} />
          ))}
          <span className="winner-card__names">
            {t.yes.length > 0
              ? t.yes.map(name).join(", ")
              : "Nog geen deelnemers bevestigd."}
          </span>
        </div>
        {/* Twijfelaars (#803): juist hier telt het — met "nog 1 speler nodig"
            wil je weten wie je nog kunt porren. */}
        {t.maybe.length > 0 && (
          <p className="winner-card__maybe">
            Misschien: {t.maybe.map(name).join(", ")}
          </p>
        )}

        {/* Fase-secties (#349): kiezen → boeken → klaarzetten; alleen de
            actuele stap springt eruit, de rest blijft compact. */}
        <section
          className={`winner-card__section${poll.status === "locked" ? " is-current" : ""}`}
        >
          <h3 className="winner-card__section-title">Boeken</h3>
          {poll.status === "locked" ? (
            <div className="winner-card__actions">
              {canBook && (
                <a
                  className="btn btn--sm btn--primary"
                  href={bookHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  Boek op Playtomic ↗
                </a>
              )}
              {isManager && (
                <button
                  className="btn btn--sm"
                  disabled={busy}
                  onClick={() => setBoekSheet("boeken")}
                >
                  Baan geboekt ✓
                </button>
              )}
              <button className="btn btn--sm" onClick={shareWinner}>
                ↗ Deel
              </button>
            </div>
          ) : (
            <>
              <p className="winner-card__section-done">
                Geboekt ✓ · {club.name}
              </p>
              {/* Banen (#802) en toegangscode (#675): de plek waar je ze zoekt
                  als je voor de deur staat — tik op de code = klembord. Alleen
                  groepsleden zien dit. */}
              <div className="winner-card__code-row">
                {banenGeboekt != null && (
                  <span className="winner-card__code winner-card__code--static">
                    🎾 <strong>{courtsLabel(banenGeboekt)}</strong>
                  </span>
                )}
                {code != null && (
                  <button
                    type="button"
                    className="winner-card__code"
                    onClick={copyCode}
                    title="Tik om te kopiëren"
                    aria-label={`Toegangscode ${code} kopiëren`}
                  >
                    <span aria-hidden="true">🔑</span> <strong>{code}</strong>
                  </button>
                )}
                {isManager && (
                  <button
                    type="button"
                    className="btn btn--sm winner-card__code-edit"
                    disabled={busy}
                    onClick={() => setBoekSheet("wijzigen")}
                  >
                    {banenGeboekt == null && code == null
                      ? "＋ Baan & code"
                      : "Wijzig baan & code"}
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {poll.status === "booked" && (
          <section
            className={`winner-card__section${t.yes.length < 4 || roundsDone ? " is-current" : ""}`}
          >
            <h3 className="winner-card__section-title">Agenda & delen</h3>
            <div className="winner-card__actions">
              <button className="btn btn--sm" onClick={exportIcs}>
                📅 Zet in agenda
              </button>
            </div>
            {/* Twee expliciete keuzes (#675), zoals ShareAvailability: de
                tekstregels voor de groepschat, of de opstelling als poster
                met de FUT-kaarten van de deelnemers. */}
            <ShareSpeeldag
              groupName={groupName}
              moment={`${longDay(o.date)} · ${o.start_time}`}
              // De baan hoort bij de plek en mag gewoon op de poster (#802):
              // anders dan de toegangscode opent een baannummer geen deur, dus
              // daar hoeft geen opt-in voor. Bij een lange clubnaam kapt de
              // header-regel zichzelf af.
              club={`${club.name} · ${o.duration} min${
                banenGeboekt != null ? ` · ${courtsLabel(banenGeboekt)}` : ""
              }`}
              deelnemers={t.yes}
              profiles={profiles}
              bestand={`padel-${o.date}.png`}
              accessCode={code}
              shareUrl={pollShareUrl(poll.id)}
              onShareText={shareWinner}
            />
          </section>
        )}

        {/* Rondes genereren: expliciete actie zodra er genoeg
            bevestigde spelers zijn (4 per baan). */}
        <section
          className={`winner-card__section${poll.status === "booked" && t.yes.length >= 4 && !roundsDone ? " is-current" : ""}`}
        >
          <h3 className="winner-card__section-title">Klaarzetten</h3>
          <div className="winner-card__rounds">
            {/* Aantal rondes vóór de knop: je kiest eerst hoeveel, dan zet je
                ze klaar — en het label van de knop volgt de keuze. */}
            {t.yes.length >= 4 && (
              <label className="winner-card__rondes">
                <span>Rondes</span>
                <select
                  className="select"
                  value={rondes}
                  disabled={busy}
                  onChange={(e) => setRondes(Number(e.target.value))}
                >
                  {RONDE_KEUZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className={`btn btn--sm${poll.status === "booked" && !roundsDone && t.yes.length >= 4 ? " btn--primary" : ""}`}
              disabled={busy || t.yes.length < 4}
              title={
                t.yes.length < 4
                  ? "Minstens 4 bevestigde spelers nodig"
                  : "Elo-gebalanceerde teams per baan, als geplande matches"
              }
              onClick={generateRounds}
            >
              ⚡{" "}
              {rondes > 1
                ? `Genereer ${rondes} rondes`
                : roundsMade === 0
                  ? "Genereer wedstrijden"
                  : "Nog een ronde"}
              {t.yes.length >= 4 &&
                ` (${banen * rondes} ${banen * rondes === 1 ? "match" : "matches"})`}
            </button>
            {/* Reis-CTA (#106): na het klaarzetten door naar Vandaag. Mét
                ?tab=spelen (#727) — het kale pad is de route waar je al op
                staat, dus dat wisselt geen tab. */}
            {roundsDone && (
              <Link
                className="btn btn--sm"
                to={`/groepen/${poll.group_id}?tab=spelen`}
              >
                Bekijk de wedstrijden →
              </Link>
            )}
            {t.yes.length < 4 && (
              <span className="winner-card__rounds-hint">
                Nog <strong>{4 - t.yes.length}</strong>{" "}
                {4 - t.yes.length === 1
                  ? "bevestigde speler"
                  : "bevestigde spelers"}{" "}
                nodig voor wedstrijden
              </span>
            )}
          </div>
        </section>
      </div>

      {boekSheet !== null && (
        <BookingSheet
          open
          busy={busy}
          initial={
            boekSheet === "wijzigen"
              ? { courts: banenGeboekt, accessCode: code }
              : {}
          }
          title={
            boekSheet === "boeken"
              ? "Baan geboekt ✓"
              : banenGeboekt == null && code == null
                ? "Baan & code toevoegen"
                : "Baan & code wijzigen"
          }
          confirmLabel={
            boekSheet === "boeken" ? "Markeer als geboekt" : "Opslaan"
          }
          onClose={() => setBoekSheet(null)}
          onSubmit={submitBooking}
        />
      )}
    </li>
  );
}
