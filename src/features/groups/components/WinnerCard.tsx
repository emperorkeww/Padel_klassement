import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/ui/ToastProvider";
import { Avatar } from "@/ui/Avatar";
import { errorMessage } from "@/lib/utils/errors";
import { fairTeams } from "@/features/groups/fairTeamsLogic";
import { icsEvent, downloadIcs } from "@/lib/utils/ics";
import { bookingUrl } from "@/features/availability/api";
import { useBookingUrl } from "@/features/availability/useBookingUrl";
import { shareOrCopyText } from "@/lib/utils/shareText";
import { displayName } from "@/features/profiles/api";
import {
  markPollBooked,
  pollShareUrl,
  setPollAccessCode,
  type PlayPoll,
  type PollOption,
} from "@/features/groups/pollsApi";
import { AccessCodeSheet } from "./AccessCodeSheet";
import { ShareSpeeldag } from "./ShareSpeeldag";
import type { OptionTally } from "@/features/groups/pollLogic";
import { createFairRound } from "@/features/groups/api";
import { getPlayerRatings } from "@/features/standings/ratingsApi";
import { isPlaytomicClub, type Club } from "@/features/availability/club";
import type { Profile } from "@/types";
import { longDay, shortDay } from "../planPollHelpers";

/* ------------------------------------------------------------------ */
/* Winner-card: het gekozen/geboekte moment met boeken, agenda, delen  */
/* en het klaarzetten van eerlijke rondes.                             */
/* ------------------------------------------------------------------ */

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

  // Toegangscode-sheet (#675). "boeken" hangt de code aan de boekstap vast,
  // "wijzigen" zet 'm los achteraf — de code komt vaak pas met de
  // bevestigingsmail. null = sheet dicht.
  const [codeSheet, setCodeSheet] = useState<"boeken" | "wijzigen" | null>(null);
  const code = poll.access_code;

  function submitCode(value: string | null) {
    const mode = codeSheet;
    setCodeSheet(null);
    if (mode === "boeken") {
      void run(() => markPollBooked(poll.id, value), "Speeldag geboekt ✓");
      return;
    }
    void run(
      () => setPollAccessCode(poll.id, value),
      value ? "Code opgeslagen." : "Code gewist.",
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
    // De toegangscode (#675) hoort juist hier: op het moment dat je hem nodig
    // hebt staat hij al in je agenda, zonder de app te openen. Een ICS is een
    // persoonlijke download, geen deelbare poster — dus geen opt-in nodig.
    const beschrijving = [
      `Deelnemers: ${t.yes.map(name).join(", ") || "nog onbekend"}`,
      ...(code != null ? [`Toegangscode: ${code}`] : []),
    ].join("\n");
    downloadIcs(
      `padel-${o.date}.ics`,
      icsEvent({
        title: `Padel — ${club.name}`,
        description: beschrijving,
        location: club.name,
        date: o.date,
        startTime: o.start_time,
        durationMin: o.duration,
        uid: `vamos-poll-${poll.id}`,
      }),
    );
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
        ? "✅ Baan geboekt — tot dan!"
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
        url: pollShareUrl(poll.group_id, poll.id),
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
      const teams = fairTeams(t.yes, ratings, roundsMade);
      const courts = teams.courts.map((c) => ({
        teamA: c.teamA.playerIds,
        teamB: c.teamB.playerIds,
      }));
      if (courts.length === 0) throw new Error("Geen volledige banen te vullen.");
      const ids = await createFairRound(poll.group_id, courts);
      setRoundsMade((n) => n + 1);
      onRoundsMade?.();
      toast.success(
        ids.length === 1
          ? "Eerlijke match klaargezet — zie Vandaag."
          : `${ids.length} eerlijke matches klaargezet — zie Vandaag.`,
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
                  onClick={() => setCodeSheet("boeken")}
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
              {/* Toegangscode (#675): de plek waar je 'm zoekt als je voor de
                  deur staat — tik = klembord. Alleen groepsleden zien dit. */}
              <div className="winner-card__code-row">
                {code != null && (
                  <button
                    type="button"
                    className="winner-card__code"
                    onClick={copyCode}
                    title="Tik om te kopiëren"
                  >
                    🔑 <strong>{code}</strong>
                  </button>
                )}
                {isManager && (
                  <button
                    type="button"
                    className="btn btn--sm winner-card__code-edit"
                    disabled={busy}
                    onClick={() => setCodeSheet("wijzigen")}
                  >
                    {code == null ? "＋ Code" : "Wijzig code"}
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
              club={`${club.name} · ${o.duration} min`}
              deelnemers={t.yes}
              profiles={profiles}
              bestand={`padel-${o.date}.png`}
              accessCode={code}
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
              ⚡ {roundsMade === 0 ? "Genereer wedstrijden" : "Nog een wedstrijd"}
              {t.yes.length >= 4 &&
                ` (${Math.floor(t.yes.length / 4)} ${Math.floor(t.yes.length / 4) === 1 ? "baan" : "banen"})`}
            </button>
            {/* Reis-CTA (#106): na het klaarzetten door naar Vandaag. */}
            {roundsDone && (
              <Link className="btn btn--sm" to={`/groepen/${poll.group_id}`}>
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

      {codeSheet !== null && (
        <AccessCodeSheet
          open
          busy={busy}
          initial={codeSheet === "wijzigen" ? code : null}
          title={
            codeSheet === "boeken"
              ? "Baan geboekt ✓"
              : code == null
                ? "Code toevoegen"
                : "Code wijzigen"
          }
          confirmLabel={
            codeSheet === "boeken" ? "Markeer als geboekt" : "Opslaan"
          }
          onClose={() => setCodeSheet(null)}
          onSubmit={submitCode}
        />
      )}
    </li>
  );
}
