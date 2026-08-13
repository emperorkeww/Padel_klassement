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
  verzetMoment,
  setPollClub,
  reopenPoll,
  cancelPoll,
  PorTeSnelError,
  remindPoll,
  pollClub,
  pollShareUrl,
  type PlayPoll,
  type PollOption,
  type PollVote,
  type PollVoteStatus,
  type NewPollOption,
} from "@/features/groups/pollsApi";
import { useIsAdmin } from "@/features/admin/useIsAdmin";
import { zetPollStatus } from "@/features/admin/api";
import {
  besteOptie,
  diffPollOptions,
  nonVoters,
  optionState,
  PLAYERS_PER_COURT,
  tallyOption,
  vastlegbaar,
} from "@/features/groups/pollLogic";
import {
  downloadSpeeldagIcs,
  laatsteWijziging,
  type SpeeldagAgenda,
} from "@/features/groups/speeldagIcs";
import { shareOrCopyText } from "@/lib/utils/shareText";
import type { GroupMember, Profile } from "@/types";
import { openPollShareText } from "../pollShareText";
import { shortDay } from "../planPollHelpers";
import { useConfirm } from "@/ui/ConfirmDialog";
import { PollWizard } from "./PollWizard";
import { PollWizardSheet } from "./PollWizardSheet";
import { WinnerCard } from "./WinnerCard";
import { PollOptionRow } from "./PollOptionRow";
import { MomentKiezer } from "./MomentKiezer";

/* ------------------------------------------------------------------ */
/* Poll-kaart: fase-verloop + compacte stemrijen.                      */
/* ------------------------------------------------------------------ */

/* De kaartkop volgt de fase (#721): sinds de tab een vastgelegde en een
   stemmende speeldag naast elkaar toont, zouden twee kaarten met dezelfde
   kop "Speeldag-poll" niet meer uit elkaar te houden zijn. */
const CARD_TITLE: Record<PlayPoll["status"], string> = {
  open: "Speeldag — stemmen open",
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
  // "Ander moment…" (#1181): de lijst waaruit de beheerder zelf kiest.
  const [kiezen, setKiezen] = useState(false);
  const [confirm, confirmUi] = useConfirm();
  // Optimistisch stemmen: de tik is meteen zichtbaar, de server volgt.
  const [voteOverlay, setVoteOverlay] = useState<
    Map<string, PollVoteStatus | null>
  >(new Map());

  const isManager = poll.created_by === myId || isOwner;
  // De beheerder van de app mag een speeldag afblazen die hij niet zelf startte
  // (#1159) — bewust álleen dat. Vastleggen en boeken zijn groepsbeslissingen,
  // en alle andere managerknoppen schrijven rechtstreeks op play_polls, wat RLS
  // weigert voor wie geen maker of eigenaar is. Ze tonen zou een knop opleveren
  // die niets doet.
  const isAppAdmin = useIsAdmin() === true;
  const magAnnuleren = isManager || isAppAdmin;
  const annuleerAlsBeheerder = !isManager && isAppAdmin;
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
      // Binnen de cooldown (#1273) is dit geen storing maar een antwoord: de
      // groep is net al gepord. De knop gaat weg, zoals na een geslaagde por.
      if (err instanceof PorTeSnelError) {
        setRemindedDone(true);
        toast.info(err.message);
      } else {
        toast.error(errorMessage(err));
      }
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
    changedAt: laatsteWijziging(poll),
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

  // Beste kandidaat voor de "Kies …"-knop: meeste ja's onder de haalbare. Een
  // advies, geen wet: via "Ander moment…" legt de beheerder er zelf één vast.
  const bestOption = useMemo(
    () => besteOptie(options, votes, liveFree, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, votes, week, today],
  );

  /* Momenten waaruit nog te kiezen valt (#1181). Bij één kandidaat voegt de
     lijst niets toe aan de knop die 'm al voorstelt. */
  const keuzes = options.filter((o) => vastlegbaar(o, today));

  /* Zoals het er nu voor staat, annuleert `poll-deadline` deze speeldag
     (#1234, #1271). Eén bron: `besteOptie` hanteert sinds #1271 exact de regel
     van de cron, dus "geen aanbeveling" en "de automaat kiest niets" zijn
     hetzelfde geworden. Op kaartniveau, want het is geen eigenschap van één rij
     — en de annulering treft de hele speeldag. */
  const geenMomentHaalbaar =
    poll.status === "open" && keuzes.length > 0 && bestOption == null;
  /* En waaróm niet: te weinig volk of te weinig baan. Zonder dat onderscheid
     stuur je iemand op zoek naar stemmers terwijl de club vol zit. */
  const tekortAanVolk = keuzes.every((o) => tallyOption(o, votes).tekort > 0);
  // Ook bij `booked` (#1271): staat de baan geboekt en moet het een half uur
  // later, dan hoor je daarvoor niet je baancode weg te gooien via "Heropen
  // stemmen". `verzetMoment` laat de boeking staan.
  const magKiezen =
    isManager &&
    (poll.status === "open" ||
      poll.status === "locked" ||
      poll.status === "booked");
  // Alleen openen als er écht iets te kiezen valt: het al vastgelegde moment is
  // geen keuze meer, dus één kandidaat leverde een sheet op met één regel, en
  // die stond disabled met de badge "nu gekozen".
  const andereKeuzes = keuzes.filter((o) => o.id !== poll.locked_option_id);
  const toonKiezer = magKiezen && andereKeuzes.length > 0;

  /**
   * Een moment vastleggen — ook eentje dat de telling niet voorstelt. Alleen
   * een onhaalbaar moment vraagt eerst om een bevestiging: Playtomic ziet dan
   * te weinig banen, en dat is meestal een vergissing en soms een baan die je
   * telefonisch al regelde.
   */
  async function kiesMoment(o: PollOption) {
    setKiezen(false);
    const t = tallyOption(o, votes);
    const vrij = liveFree(o);
    if (optionState(t.yes.length, vrij) === "onhaalbaar") {
      // Onhaalbaar kán alleen met bekende beschikbaarheid; ?? 0 is voor de
      // typechecker, niet voor een geval dat hier langskomt.
      const banen = vrij ?? 0;
      const ok = await confirm({
        title: "Toch dit moment vastleggen?",
        body: `${shortDay(o.date)} · ${o.start_time}: ${
          banen === 1 ? "1 baan" : `${banen} banen`
        } vrij volgens ${club.name}, en je hebt er ${t.needed} nodig voor ${
          t.yes.length
        } ${t.yes.length === 1 ? "speler" : "spelers"}.`,
        confirmLabel: "Toch vastleggen",
      });
      if (!ok) return;
    }
    // Verzetten is een andere handeling dan vastleggen (#1271): het laat status,
    // boeking, baancode en banen met rust. Alleen de eerste keer zet de poll
    // van `open` naar `locked`.
    const verzet = poll.locked_option_id != null;
    await run(async () => {
      if (verzet) await verzetMoment(poll.id, o.id);
      else await lockPoll(poll.id, o.id);
      // Wie de speeldag in zijn agenda zette, staat anders een uur te vroeg op
      // de baan: bied het bijgewerkte event meteen aan, net zoals annuleren
      // het CANCELLED-bestand meteen aanbiedt. Dezelfde UID, dus het werkt de
      // bestaande afspraak bij in plaats van er een tweede naast te zetten.
      if (verzet && agendaDag) {
        downloadSpeeldagIcs({
          ...agendaDag,
          date: o.date,
          startTime: o.start_time,
          duration: o.duration,
          changedAt: new Date().toISOString(),
        });
      }
    }, verzet ? "Moment verzet — de bijgewerkte agenda staat klaar." : "Moment vastgelegd.");
  }

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
                myId={myId}
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

      {geenMomentHaalbaar && (
        <p className="poll-card__tekort" role="status">
          Zoals het nu staat gaat deze speeldag niet door:{" "}
          {tekortAanVolk
            ? `er zijn ${PLAYERS_PER_COURT} spelers nodig op één moment.`
            : "geen enkel moment heeft genoeg vrije banen."}{" "}
          {isManager && "Leg je er zelf een vast, dan gaat hij wél door."}
        </p>
      )}

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
              // Sinds #1271 rekent deze knop met dezelfde regel als de cron,
              // dus dit ís het moment dat er anders vanzelf uit rolt.
              title="Dit moment legt de app anders zelf vast, kort voor de speeldag"
              onClick={() => kiesMoment(bestOption)}
            >
              Kies {shortDay(bestOption.date)} · {bestOption.start_time}
            </button>
          )}
          {/* De aanbeveling is één tik; hier staat de rest van de lijst (#1181).
              Bij een al gekozen speeldag verzet dit het moment zonder dat de
              stemming eerst heropend — en dus weggegooid — moet worden. Sinds
              #1271 geldt dat ook voor een geboekte speeldag: de baancode en de
              banen blijven staan, alleen de tijd schuift. */}
          {toonKiezer && (
            <button
              className="btn btn--sm"
              disabled={busy}
              title={
                poll.status === "booked"
                  ? "Verzet de speeldag; je boeking, baannummers en toegangscode blijven staan"
                  : undefined
              }
              onClick={() => setKiezen(true)}
            >
              {poll.status === "open" ? "Ander moment…" : "📅 Ander moment"}
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
          {/* Eén bevestigingsmechaniek op deze kaart (#1271). Dit was een
              two-tap ("Zeker? Tik nogmaals") die op `onBlur` reset — op touch
              onvoorspelbaar, want een scroll of een tik ernaast telt daar als
              blur — terwijl er twee knoppen verderop een echte ConfirmDialog
              stond voor een lichtere ingreep. */}
          {magAnnuleren && poll.status !== "cancelled" && (
            <button
              className="btn btn--sm proposal__withdraw"
              disabled={busy}
              onClick={async () => {
                const ok = await confirm({
                  title:
                    poll.status === "open"
                      ? "Speeldag annuleren?"
                      : "Speeldag annuleren?",
                  body:
                    poll.status === "open"
                      ? "De stemmen blijven bewaard, maar er wordt niets meer vastgelegd."
                      : "Iedereen die deze speeldag in zijn agenda zette krijgt een annulering aangeboden.",
                  confirmLabel: "Annuleren",
                  cancelLabel: "Laat staan",
                  danger: true,
                });
                if (!ok) return;
                // Het annuleerbestand meteen aanbieden: wie het pas bij een
                // volgend bezoek zou downloaden, laat de afspraak intussen in
                // ieders agenda staan.
                if (agendaDag) downloadSpeeldagIcs(agendaDag, "CANCELLED");
                void run(
                  () =>
                    annuleerAlsBeheerder
                      ? zetPollStatus(poll.id, "cancelled")
                      : cancelPoll(poll.id),
                  poll.status === "open" ? "Speeldag geannuleerd." : "Speeldag geannuleerd.",
                );
              }}
            >
              {poll.status === "open" ? "Annuleer speeldag" : "Annuleer speeldag"}
            </button>
          )}
        </div>
      )}

      {editSheet}
      {kiezen && (
        <MomentKiezer
          open
          onClose={() => setKiezen(false)}
          options={options}
          votes={votes}
          today={today}
          vrijOp={liveFree}
          prijsOp={perPersonAt}
          aanbevolenId={bestOption?.id ?? null}
          huidigId={poll.locked_option_id}
          onKies={kiesMoment}
        />
      )}
      {confirmUi}
    </section>
  );
}
