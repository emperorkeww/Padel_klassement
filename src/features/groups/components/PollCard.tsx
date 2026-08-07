import { useEffect, useMemo, useRef, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { prefersReducedMotion } from "@/lib/utils/motion";
import { addDays, dateInZone } from "@/lib/utils/time";
import { getWeekAvailability, type WeekDay } from "@/features/availability/api";
import {
  prijsPerPersoon,
  vrijeBanenOpSlot,
} from "@/features/availability/availabilityShare";
import { ClubPicker } from "@/features/availability/components/ClubPicker";
import { displayName } from "@/features/profiles/api";
import {
  addPollOption,
  removePollOption,
  setPollVote,
  clearPollVote,
  lockPoll,
  setPollClub,
  reopenPoll,
  cancelPoll,
  remindPoll,
  pollClub,
  pollShareUrl,
  type PlayPoll,
  type PollOption,
  type PollVote,
  type PollVoteStatus,
  type NewPollOption,
} from "@/features/groups/pollsApi";
import {
  diffPollOptions,
  nonVoters,
  optionState,
  tallyOption,
} from "@/features/groups/pollLogic";
import {
  downloadSpeeldagIcs,
  type SpeeldagAgenda,
} from "@/features/groups/speeldagIcs";
import { shareOrCopyText } from "@/lib/utils/shareText";
import type { GroupMember, Profile } from "@/types";
import { openPollShareText } from "../pollShareText";
import { shortDay } from "../planPollHelpers";
import { PollWizard } from "./PollWizard";
import { PollWizardSheet } from "./PollWizardSheet";
import { WinnerCard } from "./WinnerCard";
import { PollOptionRow } from "./PollOptionRow";

/* ------------------------------------------------------------------ */
/* Poll-kaart: fase-verloop + compacte stemrijen.                      */
/* ------------------------------------------------------------------ */

/* De kaartkop volgt de fase (#721): sinds de tab een vastgelegde en een
   stemmende speeldag naast elkaar toont, zouden twee kaarten met dezelfde
   kop "Speeldag-poll" niet meer uit elkaar te houden zijn. */
const CARD_TITLE: Record<PlayPoll["status"], string> = {
  open: "Speeldag-poll",
  locked: "Gekozen speeldag",
  booked: "Geboekte speeldag",
  cancelled: "Geannuleerde speeldag",
};

export function PollCard({
  poll,
  groupName,
  members,
  options,
  votes,
  profiles,
  myId,
  isOwner,
  onChanged,
  spotlight,
}: {
  poll: PlayPoll;
  groupName: string;
  members: GroupMember[];
  options: PollOption[];
  votes: PollVote[];
  profiles: Record<string, Profile>;
  myId: string;
  isOwner: boolean;
  onChanged: () => void;
  /** Je landde op deze kaart via een gedeelde link (#886): breng 'm in beeld
   *  en markeer 'm kort, zodat duidelijk is wélke speeldag bedoeld werd. */
  spotlight?: boolean;
}) {
  const toast = useToast();
  // De op de poll opgeslagen locatie (#322), niet de globale clubvoorkeur. De
  // clubtijd én de live vrije-banen-check volgen deze club.
  const club = pollClub(poll);
  const today = dateInZone(club.timezone);
  const weekAsync = useAsync<WeekDay[]>(
    () => getWeekAvailability(today, 7, club),
    [today, club.id],
  );
  const week = weekAsync.data ?? [];
  const weekLoading = weekAsync.loading;
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [remindedDone, setRemindedDone] = useState(false);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [showLosers, setShowLosers] = useState(false);
  // Dichtgeklapt zodra de baan geboekt is (#1141). Dan is het kiezen voorbij en
  // blijven er nog twee dingen over: wedstrijden klaarzetten en delen. De rest
  // van de kaart — deelnemers, twijfelaars, boekgegevens, agenda, annuleren —
  // staat achter "Details".
  const [dicht, setDicht] = useState(poll.status === "booked");
  // Ook ter plekke, op het moment dat iemand "Baan geboekt ✓" tikt: dan is de
  // kaart klaar met wat hij te zeggen had.
  useEffect(() => {
    if (poll.status === "booked") setDicht(true);
  }, [poll.status]);
  // "Dagen aanpassen" (#128): wizard heropent met de bestaande momenten.
  const [editing, setEditing] = useState(false);
  // Optimistisch stemmen: de tik is meteen zichtbaar, de server volgt.
  const [voteOverlay, setVoteOverlay] = useState<
    Map<string, PollVoteStatus | null>
  >(new Map());

  const isManager = poll.created_by === myId || isOwner;
  const weekEnd = addDays(today, 6);
  const name = (id: string) => displayName(profiles[id]);

  /* Landen vanuit een gedeelde link (#886). De kaart stond al open (openId in
     PlanSection), maar je keek nog naar de bovenkant van de tab: bij een groep
     met een vastgelegde speeldag erboven staan de stemknoppen onder de vouw.
     Mikken op de stemrijen en niet op de kaartkop — de vraag is "wanneer kun
     jij?", dus die knoppen horen in beeld. Bij een gekozen of geboekte
     speeldag valt dat terug op de kaart zelf: daar valt niets te stemmen. */
  const stemRijenRef = useRef<HTMLUListElement>(null);
  const kaartRef = useRef<HTMLElement>(null);
  const gespot = useRef(false);

  useEffect(() => {
    // Eén keer per mount: een re-render (stem binnen via realtime, banen
    // geladen) mag je niet opnieuw naar boven trekken terwijl je zit te lezen.
    if (!spotlight || gespot.current) return;
    const doel = stemRijenRef.current ?? kaartRef.current;
    if (!doel) return;
    gespot.current = true;
    // jsdom kent scrollIntoView niet (zelfde guard als PageTabs).
    if (typeof doel.scrollIntoView === "function") {
      doel.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "center",
      });
    }
  }, [spotlight]);
  /* De markering zelf hangt aan de prop, niet aan een timer: de CSS-animatie
     draait één keer af en laat de kaart daarna staan zoals hij was. Een
     setTimeout die de klasse weer weghaalt leverde alleen een tijdgevoelige
     test op, zonder dat je er iets aan ziet. */

  /** Live vrije banen binnen het datavenster; anders de momentopname. */
  function liveFree(o: PollOption): number | null {
    if (o.date >= today && o.date <= weekEnd) {
      const live = vrijeBanenOpSlot(week, o.date, o.start_time, o.duration);
      if (live != null) return live;
    }
    return o.courts_free;
  }

  async function run(fn: () => Promise<void>, done?: string) {
    setBusy(true);
    try {
      await fn();
      onChanged();
      if (done) toast.success(done);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remind() {
    setBusy(true);
    try {
      const n = await remindPoll(poll.group_id, poll.id);
      setRemindedDone(true);
      toast.success(
        n === 0 ? "Iedereen heeft al gestemd." : `${n} ${n === 1 ? "lid" : "leden"} herinnerd.`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /**
   * De lopende stemming delen (#886). "Herinner" bereikt alleen wie push aan
   * heeft staan; dit gaat naar de groepschat, waar het plannen toch al gebeurt.
   * De deep-link opent bij de ontvanger déze poll — ook als er meerdere lopen.
   */
  async function deelPoll() {
    setBusy(true);
    try {
      const outcome = await shareOrCopyText({
        title: `Padel — ${groupName}`,
        text: openPollShareText({
          groepsnaam: groupName,
          clubnaam: club.name,
          options,
          votes,
          memberIds: members.map((m) => m.player_id),
          naam: name,
          today,
        }),
        // Als los url-veld: het deelvenster maakt er een nette preview van en
        // het klembord zet 'm onder de tekst.
        url: pollShareUrl(poll.id),
      });
      if (outcome === "clipboard") toast.success("Tekst gekopieerd naar klembord.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /** Mijn stem op een optie, inclusief de optimistische overlay. */
  function myVote(optionId: string): PollVoteStatus | null {
    if (voteOverlay.has(optionId)) return voteOverlay.get(optionId) ?? null;
    return (
      votes.find((v) => v.option_id === optionId && v.player_id === myId)
        ?.status ?? null
    );
  }

  /** Stem zetten/wisselen: meteen zichtbaar, server volgt op de achtergrond. */
  function castVote(o: PollOption, status: PollVoteStatus) {
    const previous = myVote(o.id);
    const next = previous === status ? null : status;
    setVoteOverlay((cur) => new Map(cur).set(o.id, next));
    const call =
      next === null
        ? clearPollVote(o.id, myId)
        : setPollVote(o.id, poll.group_id, myId, next);
    call.then(onChanged).catch((err) => {
      setVoteOverlay((cur) => new Map(cur).set(o.id, previous));
      toast.error(errorMessage(err));
    });
  }

  const locked = poll.locked_option_id
    ? options.find((o) => o.id === poll.locked_option_id) ?? null
    : null;

  /**
   * De speeldag als agenda-event (#1099). Alleen zinvol met een vastgelegd
   * moment: zonder dat is er niets om in of uit een agenda te zetten.
   */
  const agendaDag: SpeeldagAgenda | null = locked && {
    pollId: poll.id,
    groupName,
    clubName: poll.club_name,
    date: locked.date,
    startTime: locked.start_time,
    duration: locked.duration,
    courts: poll.courts,
    accessCode: poll.access_code,
    changedAt: poll.booked_at ?? poll.locked_at ?? poll.created_at,
  };

  /** ± prijs per persoon voor een optie, uit de Playtomic-slotdata. */
  function perPersonAt(o: PollOption): string | null {
    return prijsPerPersoon(week, o.date, o.start_time, o.duration);
  }

  // Wie stemde nog op geen enkele optie? Maakt de herinnering gericht.
  const waiting =
    poll.status === "open"
      ? nonVoters(
          members.map((m) => m.player_id),
          options,
          votes,
        )
      : [];

  // Beste kandidaat voor de "Kies …"-knop: meeste ja's onder de haalbare.
  const bestOption = useMemo(() => {
    let best: { option: PollOption; yes: number } | null = null;
    for (const o of options) {
      const t = tallyOption(o, votes);
      const state = optionState(t.yes.length, liveFree(o));
      if (state === "onhaalbaar" || o.date < today) continue;
      if (!best || t.yes.length > best.yes) best = { option: o, yes: t.yes.length };
    }
    return best?.option ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, votes, week, today]);

  // Bij locked/booked: winnaar groot, de rest ingeklapt. Bij booked blijven de
  // niet-gekozen opties zelfs helemaal verborgen (#322): je kunt toch niet meer
  // terug, dus tonen ze zou enkel verwarren.
  const winnerFirst =
    locked && poll.status !== "open"
      ? [locked, ...options.filter((o) => o.id !== locked.id)]
      : options;
  const collapsed =
    poll.status === "booked" || (poll.status === "locked" && !showLosers);

  // "Dagen aanpassen": wizard in een sheet (#349), voorgevuld met de huidige
  // momenten; het verschil wordt bij bewaren als losse add/removes doorgevoerd
  // zodat stemmen op ongewijzigde momenten blijven staan.
  const initialPicked = new Map<string, NewPollOption>(
    options.map((o) => [
      `${o.date}|${o.start_time}`,
      {
        date: o.date,
        startTime: o.start_time,
        duration: o.duration,
        courtsFree: o.courts_free,
      },
    ]),
  );
  const editSheet = (
    <PollWizardSheet
      open={editing}
      onClose={() => setEditing(false)}
      title="Dagen aanpassen"
    >
      <PollWizard
        today={today}
        week={week}
        weekLoading={weekLoading}
        club={club}
        initialPicked={initialPicked}
        submitLabel={(n) => `Bewaar dagen (${n})`}
        confirmHint={(picked) => {
          const removed = options.filter(
            (o) => !picked.has(`${o.date}|${o.start_time}`),
          );
          if (removed.length === 0) return null;
          const votesLost = removed.some((o) =>
            votes.some((v) => v.option_id === o.id),
          );
          return `${removed.length} ${removed.length === 1 ? "moment vervalt" : "momenten vervallen"}${votesLost ? ", inclusief de stemmen daarop" : ""}.`;
        }}
        onSubmit={async (_options, picked) => {
          const { toAdd, toRemoveIds } = diffPollOptions(options, picked);
          for (const optionId of toRemoveIds) {
            await removePollOption(optionId);
          }
          for (const o of toAdd) {
            await addPollOption(poll.id, poll.group_id, o);
          }
          toast.success("Dagen bijgewerkt — de stemmen op behouden momenten staan er nog.");
        }}
        onClose={() => setEditing(false)}
        onDone={() => {
          setEditing(false);
          onChanged();
        }}
      />
    </PollWizardSheet>
  );

  return (
    <section
      ref={kaartRef}
      className={`card${spotlight ? " is-spotlight" : ""}`}
    >
      <div className="card__head">
        <h2 className="card__title">{CARD_TITLE[poll.status]}</h2>
        <div className="proposal__links">
          {/* Alleen bij een geboekte speeldag: daarvoor ben je nog aan het
              kiezen en boeken, en dan is er niets om weg te vouwen. */}
          {poll.status === "booked" && (
            <button
              className="btn btn--sm"
              aria-expanded={!dicht}
              onClick={() => setDicht((d) => !d)}
            >
              {dicht ? "Details ⌄" : "Details ⌃"}
            </button>
          )}
          {/* Locatie (#322): wijzigbaar zolang de poll niet geboekt is; daarna
              een vaste weergave, want de baan ligt dan vast. */}
          {isManager && poll.status !== "booked" ? (
            <ClubPicker
              value={club}
              onPick={(c) => run(() => setPollClub(poll.id, c), "Locatie gewijzigd.")}
              allowManual
              align="right"
            />
          ) : dicht ? null : (
            <span className="poll-card__club" title="Locatie">
              📍 {club.name}
              {club.city ? ` · ${club.city}` : ""}
            </span>
          )}
          {poll.status === "open" && isManager && (
            <button
              className="btn btn--sm"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              ✏️ Dagen aanpassen
            </button>
          )}
          {poll.status === "open" && !remindedDone && (
            <button className="btn btn--sm" disabled={busy} onClick={remind}>
              🔔 Herinner
            </button>
          )}
          {/* Delen mag elk lid (#886): wie de groep wil porren hoeft daarvoor
              niet de maker of eigenaar te zijn. */}
          {poll.status === "open" && (
            <button className="btn btn--sm" disabled={busy} onClick={deelPoll}>
              ↗ Deel
            </button>
          )}
        </div>
      </div>

      {waiting.length > 0 && (
        <p className="poll-waiting">
          Wacht op: {waiting.map(name).join(", ")}
        </p>
      )}

      <ul
        className="poll-rows"
        ref={poll.status === "open" ? stemRijenRef : null}
      >
        {winnerFirst.map((o, idx) => {
          if (collapsed && idx > 0) return null;
          const t = tallyOption(o, votes);
          const free = liveFree(o);
          const state = optionState(t.yes.length, free);
          const mine = myVote(o.id);
          const isChosen = poll.locked_option_id === o.id && poll.status !== "open";
          const detailOpen = openDetail === o.id;

          if (isChosen) {
            return (
              <WinnerCard
                key={o.id}
                poll={poll}
                option={o}
                tally={t}
                perPerson={perPersonAt(o)}
                club={club}
                groupName={groupName}
                profiles={profiles}
                isManager={isManager}
                busy={busy}
                run={run}
                compact={dicht}
              />
            );
          }

          return (
            <PollOptionRow
              key={o.id}
              option={o}
              tally={t}
              state={state}
              free={free}
              mine={mine}
              votable={poll.status === "open" && o.date >= today}
              past={o.date < today}
              detailOpen={detailOpen}
              onToggleDetail={() => setOpenDetail(detailOpen ? null : o.id)}
              onVote={(s) => castVote(o, s)}
              profiles={profiles}
            />
          );
        })}
      </ul>

      {collapsed && poll.status === "locked" && options.length > 1 && (
        <button
          className="btn btn--sm poll-card__showlosers"
          onClick={() => setShowLosers(true)}
        >
          Andere opties tonen ({options.length - 1})
        </button>
      )}

      {/* De voet draagt de zware knoppen (heropenen, annuleren). Op een
          dichtgeklapte kaart hoort daar niet per ongeluk op getikt te worden;
          hij komt terug met "Details". */}
      {!dicht && (
        <div className="proposal__actions poll-card__footer">
          {poll.status === "open" && isManager && bestOption && (
            <button
              className="btn btn--sm btn--primary"
              disabled={busy}
              onClick={() =>
                run(() => lockPoll(poll.id, bestOption.id), "Moment vastgelegd.")
              }
            >
              Kies {shortDay(bestOption.date)} · {bestOption.start_time}
            </button>
          )}
          {isManager && poll.status === "locked" && (
            <button
              className="btn btn--sm"
              disabled={busy}
              title="Terug naar de stemfase; het gekozen moment vervalt"
              onClick={() => run(() => reopenPoll(poll.id), "Stemmen heropend.")}
            >
              ↩ Heropen stemmen
            </button>
          )}
          {/* Een afgelaste speeldag verdwijnt niet vanzelf uit de agenda waarin
              iemand hem ooit zette: die kant kent geen abonnement (#1099). Dit
              bestand wist hem bij het openen — voor élk lid, niet enkel de
              beheerder, want iedereen kan hem erin gezet hebben. */}
          {poll.status === "cancelled" && agendaDag && (
            <button
              className="btn btn--sm"
              title="Downloadt een bestand dat deze speeldag uit je agenda haalt"
              onClick={() => downloadSpeeldagIcs(agendaDag, "CANCELLED")}
            >
              Haal uit je agenda
            </button>
          )}
          {isManager && poll.status !== "cancelled" && (
            <button
              className={`btn btn--sm proposal__withdraw${confirmCancel ? " is-confirm" : ""}`}
              disabled={busy}
              onClick={() => {
                if (!confirmCancel) {
                  setConfirmCancel(true);
                  return;
                }
                // Het annuleerbestand meteen aanbieden: wie het pas bij een
                // volgend bezoek zou downloaden, laat de afspraak intussen in
                // ieders agenda staan.
                if (agendaDag) downloadSpeeldagIcs(agendaDag, "CANCELLED");
                run(
                  () => cancelPoll(poll.id),
                  poll.status === "open" ? "Poll geannuleerd." : "Speeldag geannuleerd.",
                );
              }}
              onBlur={() => setConfirmCancel(false)}
            >
              {confirmCancel
                ? "Zeker? Tik nogmaals"
                : poll.status === "open"
                  ? "Annuleer poll"
                  : "Annuleer speeldag"}
            </button>
          )}
        </div>
      )}

      {editSheet}
    </section>
  );
}
