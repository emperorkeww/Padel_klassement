import { useEffect, useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { useRealtime } from "@/lib/hooks/useRealtime";
import {
  getAanwezigheid,
  zetMijnAanwezigheid,
} from "@/features/groups/aanwezigheidApi";
import { Avatar } from "@/ui/Avatar";
import { errorMessage } from "@/lib/utils/errors";
import {
  downloadSpeeldagIcs,
  laatsteWijziging,
} from "@/features/groups/speeldagIcs";
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
import { DeelSpeeldag } from "./DeelSpeeldag";
import type { OptionTally } from "@/features/groups/pollLogic";
import { isPlaytomicClub, type Club } from "@/features/availability/club";
import type { Profile } from "@/types";
import { courtsLabel, longDay, shortDay } from "../planPollHelpers";

/* ------------------------------------------------------------------ */
/* Winner-card: het gekozen/geboekte moment met boeken, agenda en      */
/* delen.                                                              */
/*                                                                     */
/* Klaarzetten zat hier ook, als eigen Elo-generator (#727): een       */
/* rondeteller met een knop, los van het speelformaat-paneel dat op    */
/* Vandaag de indeling maakt. Twee generatoren op één pagina, waarvan  */
/* er één geen spelerselectie en geen vormkeuze had. Sinds #1141 komt  */
/* de knop van buiten binnen als `klaarzetActie` — en dat is overal    */
/* hetzelfde paneel.                                                   */
/* ------------------------------------------------------------------ */

export function WinnerCard({
  poll,
  option: o,
  tally: t,
  perPerson: pp,
  club,
  groupName,
  profiles,
  myId,
  isManager,
  busy,
  run,
  compact = false,
}: {
  poll: PlayPoll;
  option: PollOption;
  tally: OptionTally;
  perPerson: string | null;
  club: Club;
  groupName: string;
  profiles: Record<string, Profile>;
  /** De kijker; nodig om jezelf af te kunnen melden (#1271). */
  myId: string;
  isManager: boolean;
  busy: boolean;
  run: (fn: () => Promise<void>, done?: string) => Promise<void>;
  /** Dichtgeklapt (#1141): alleen de regel die je aan de deur nodig hebt en de
   *  twee acties die er ná het boeken nog zijn. De rest — deelnemers,
   *  twijfelaars, boekgegevens, agenda — staat achter "Details" op de kaart
   *  eromheen. */
  compact?: boolean;
}) {
  const toast = useToast();
  const name = (id: string) => displayName(profiles[id]);
  const canBook = isPlaytomicClub(club);
  const bookHref = useBookingUrl(club, o.date);

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

  // Mijn eigen aanwezigheid op dit moment (#1271). Alleen de afwijking staat in
  // de database; geen rij betekent "volg de stemming".
  const [ikKomNiet, setIkKomNiet] = useState(false);
  const [afmeldBezig, setAfmeldBezig] = useState(false);
  useEffect(() => {
    let levend = true;
    void getAanwezigheid(o.id)
      .then((k) => {
        if (levend) setIkKomNiet(k[myId] === false);
      })
      .catch(() => {
        /* onbekend blijft "ik doe mee": de stemming is de bron */
      });
    return () => {
      levend = false;
    };
  }, [o.id, myId]);
  useRealtime("play_poll_presence", () => {
    void getAanwezigheid(o.id).then((k) => setIkKomNiet(k[myId] === false));
  }, `option_id=eq.${o.id}`);

  async function zetAanwezig() {
    const volgende = !ikKomNiet;
    setAfmeldBezig(true);
    setIkKomNiet(volgende);
    try {
      await zetMijnAanwezigheid(o.id, poll.group_id, myId, volgende ? false : null);
      toast.success(
        volgende ? "Afgemeld — de groep ziet het." : "Je doet weer mee.",
      );
    } catch (err) {
      setIkKomNiet(!volgende);
      toast.error(errorMessage(err));
    } finally {
      setAfmeldBezig(false);
    }
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
      changedAt: laatsteWijziging(poll),
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

  /** Kop: baangroene band met het moment + status. */
  const kop = (
    <div className="winner-card__head">
      <span className="winner-card__when">
        🎾 {longDay(o.date)} · {o.start_time}
      </span>
      <span className="winner-card__status">
        {poll.status === "booked" ? "Geboekt ✓" : "Gekozen"}
      </span>
    </div>
  );

  /** Banen (#802) en toegangscode (#675): de plek waar je ze zoekt als je voor
   *  de deur staat — tik op de code = klembord. Alleen groepsleden zien dit. */
  const baanEnCode = (
    <>
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
    </>
  );

  /** Delen en agenda-export, achter één knop (#1141). */
  const deelKnop = (
    <DeelSpeeldag
      groupName={groupName}
      moment={`${longDay(o.date)} · ${o.start_time}`}
      // De baan hoort bij de plek en mag gewoon op de poster (#802): anders dan
      // de toegangscode opent een baannummer geen deur, dus daar hoeft geen
      // opt-in voor. Bij een lange clubnaam kapt de header-regel zichzelf af.
      club={`${club.name} · ${o.duration} min${
        banenGeboekt != null ? ` · ${courtsLabel(banenGeboekt)}` : ""
      }`}
      deelnemers={t.yes}
      profiles={profiles}
      bestand={`padel-${o.date}.png`}
      accessCode={code}
      shareUrl={pollShareUrl(poll.id)}
      onShareText={shareWinner}
      onAgenda={exportIcs}
    />
  );

  // Dichtgeklapt (#1141): wanneer, waar, welke baan, welke code — en de twee
  // dingen die er na het boeken nog te doen zijn. Alles wat hier niet staat
  // komt terug achter "Details" op de kaart eromheen.
  if (compact) {
    return (
      <li className="winner-card winner-card--compact">
        {kop}
        <div className="winner-card__body">
          <p className="winner-card__meta">
            {o.duration} min · {club.name}
          </p>
          <div className="winner-card__code-row">{baanEnCode}</div>
          <div className="winner-card__actions">{deelKnop}</div>
        </div>
      </li>
    );
  }

  return (
    <li className="winner-card">
      {kop}

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

        {/* Afmelden ná het vastleggen (#1271). Stemmen kan alleen zolang de
            poll open is, dus wie ná het vastleggen afhaakte kon dat nergens
            zeggen: de organisator zette het in zijn eigen browser, en de speler
            zag zichzelf gewoon in de opstelling staan. Dit schrijft naar
            play_poll_presence, dezelfde bron waaruit de indeling put. */}
        {!compact && (
          <p className="winner-card__afmelden">
            <button
              type="button"
              className="btn btn--sm"
              disabled={afmeldBezig}
              onClick={zetAanwezig}
            >
              {ikKomNiet ? "Toch weer mee" : "Ik kan toch niet"}
            </button>
            {ikKomNiet && (
              <span className="winner-card__afmeld-uitleg">
                Je staat niet in de indeling.
              </span>
            )}
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
              <div className="winner-card__code-row">
                {baanEnCode}
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

        {/* Delen is de stap die in deze kaart overblijft: indelen gebeurt in
            het speelformaat-paneel op de pagina zelf (#1146). */}
        {poll.status === "booked" && (
          <section className="winner-card__section is-current">
            <h3 className="winner-card__section-title">Delen & agenda</h3>
            <div className="winner-card__actions">{deelKnop}</div>
          </section>
        )}

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
