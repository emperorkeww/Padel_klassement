import { useEffect, useMemo, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { dateInZone } from "@/lib/utils/time";
import { useClub } from "@/features/availability/club";
import { displayName } from "@/features/profiles/api";
import {
  americanoRound,
  applyRound,
  historyFromMatches,
} from "@/features/groups/americano";
import { createFairRound, generateMexicanoRound } from "@/features/groups/api";
import {
  getGroupPolls,
  getGroupPollOptions,
  getGroupPollVotes,
  type PlayPoll,
  type PollOption,
} from "@/features/groups/pollsApi";
import { tallyOption } from "@/features/groups/pollLogic";
import { rondeStart, rondesOpDag } from "@/features/groups/speeldagRondes";
import { FairTeamsCard } from "@/features/groups/components/FairTeams";
import {
  bewaarKeuzes,
  leesKeuzes,
  pasKeuzesToe,
  type AanwezigKeuzes,
} from "@/features/groups/aanwezigOpslag";
import { SpelersKiezer } from "@/features/groups/components/SpelersKiezer";
import { SpeelformaatKaart } from "@/features/groups/components/SpeelformaatKaart";
import type { KiesbareSpeler } from "@/features/groups/spelersKiezer";
import type { Speelvorm } from "@/features/groups/speelformaat";
import type { GroupMember, Match, Profile, Team } from "@/types";
import "@/features/groups/Proposals.css";

// "Maak teams": de ene teamgenerator van de groep (#106). Deelnemers komen
// uit het speelvoorstel van de speeldag (handmatig bij te sturen), het formaat
// is een keuze — Eerlijk (Elo-gebalanceerd, met voorbeeld), Americano
// (wisselende partners) of Mexicano (paren op de stand). Vervangt de losse
// "Vanavond"-, eerlijke-teams- en Americano/Mexicano-kaarten.
//
// Welke speeldag dat is, hing tot #1133 vast aan vandaag: de generator zocht
// zelf de poll van deze kalenderdag op. De speeldagpagina genereert voor een
// dag die nog moet komen (of al geweest is) en geeft die daarom mee.

type Format = Speelvorm;

/** De speeldag waarvoor gegenereerd wordt: draagt de deelnemers en — via het
 *  moment — de starttijden die de nieuwe rondes meekrijgen (#827). */
export type GeneratorSpeeldag = {
  /** Kalenderdag in clubtijd (YYYY-MM-DD). */
  dag: string;
  option: PollOption;
  poll: PlayPoll;
  /** Ja-stemmers van dat moment; het vertrekpunt van de selectie. */
  yes: string[];
};

export function MakeTeams({
  groupId,
  members,
  profiles,
  myId,
  matches,
  teams,
  openRound,
  speeldag,
  onGenerated,
}: {
  groupId: string;
  members: GroupMember[];
  profiles: Record<string, Profile>;
  myId: string;
  matches: Match[];
  teams: Record<string, Team>;
  /** Ronde met nog openstaande uitslagen (blokkeert Mexicano), of null. */
  openRound: { round: number } | null;
  /** De speeldag waarvoor gegenereerd wordt (#1133). Zonder waarde zoekt de
   *  generator zelf de speeldag van vandaag op — het gedrag op de Spelen-tab. */
  speeldag?: GeneratorSpeeldag | null;
  onGenerated: () => void;
}) {
  const club = useClub();
  const toast = useToast();
  // Zonder meegegeven speeldag draait de generator op vandaag en zoekt hij de
  // poll zelf op; dan (en alleen dan) heeft hij de drie queries hieronder nodig.
  const zelfZoeken = speeldag == null;
  const today = dateInZone(club.timezone);
  const dag = speeldag?.dag ?? today;
  const [format, setFormat] = useState<Format>("eerlijk");
  const [roundsToGen, setRoundsToGen] = useState(1);
  const [busy, setBusy] = useState(false);
  // Eerlijk levert geen ronde maar een voorstel; dat verschijnt pas als je erom
  // vraagt, zodat het paneel niet meteen een half scherm aan teams uitrolt.
  const [eerlijkGevraagd, setEerlijkGevraagd] = useState(false);

  const polls = useAsync<PlayPoll[]>(() => getGroupPolls(groupId), [groupId], {
    enabled: zelfZoeken,
  });
  const options = useAsync<PollOption[]>(
    () => getGroupPollOptions(groupId),
    [groupId],
    { enabled: zelfZoeken },
  );
  const votes = useAsync(() => getGroupPollVotes(groupId), [groupId], {
    enabled: zelfZoeken,
  });
  useRealtime("play_poll_votes", votes.reload, `group_id=eq.${groupId}`);

  // Het gekozen/meest gesteunde poll-moment van vandaag: de deelnemers, plus
  // de optie en poll zelf — die dragen de starttijd die de gegenereerde
  // matches meekrijgen (#827). Zonder poll vandaag zijn alle leden het
  // vertrekpunt en blijft de match zonder tijdstip, zoals voorheen.
  const vanavond = useMemo(() => {
    const live = (polls.data ?? []).filter((p) => p.status !== "cancelled");
    const todays = (options.data ?? []).filter(
      (o) => o.date === today && live.some((p) => p.id === o.poll_id),
    );
    const chosen = todays.find((o) =>
      live.some(
        (p) =>
          p.locked_option_id === o.id &&
          (p.status === "locked" || p.status === "booked"),
      ),
    );
    let best: PollOption | null = chosen ?? null;
    if (!best) {
      let bestYes = -1;
      for (const o of todays) {
        const yes = tallyOption(o, votes.data ?? []).yes.length;
        if (yes > bestYes) {
          bestYes = yes;
          best = o;
        }
      }
    }
    if (!best) return null;
    const poll = live.find((p) => p.id === best.poll_id) ?? null;
    return {
      yes: tallyOption(best, votes.data ?? []).yes,
      option: best,
      poll,
    };
  }, [polls.data, options.data, votes.data, today]);

  // De speeldag waarvoor we genereren: meegegeven (speeldagpagina) of zelf
  // gevonden (Spelen-tab). Beide dragen hetzelfde: wie er ja zei en op welk
  // moment er gespeeld wordt.
  const gekozen: {
    yes: string[];
    option: PollOption;
    poll: PlayPoll | null;
  } | null = speeldag ?? vanavond;

  const tonightYes = gekozen?.yes ?? null;

  // Starttijd van de eerstvolgende ronde: tien minuten per al klaargezette
  // ronde opschuivend vanaf het gekozen moment. De rondes die er op die dag al
  // staan tellen mee, dus een tweede generatie landt niet bovenop de eerste.
  const startVanRonde = (index: number): string | null => {
    if (!gekozen) return null;
    const tz = gekozen.poll?.club_timezone ?? club.timezone;
    return rondeStart(gekozen.option, tz, rondesOpDag(matches, tz, dag) + index);
  };

  // Handmatig bij te sturen selectie; nieuwe stemmen zijn de bron van
  // waarheid, de toggles een last-minute correctie.
  //
  // Sinds #1089 overleven die correcties een refresh. Wat we bewaren zijn niet
  // de aanwezigen maar de afwijkingen per speler, zodat de poll de bron blijft
  // voor iedereen die je nog niet hebt aangeraakt — zie aanwezigOpslag.ts.
  const defaultKey = (tonightYes ?? members.map((m) => m.player_id)).join(",");
  const ledenKey = members.map((m) => m.player_id).join(",");
  const [keuzes, setKeuzes] = useState<AanwezigKeuzes>({});
  useEffect(() => {
    setKeuzes(leesKeuzes(groupId, dag));
  }, [groupId, dag]);

  const selected = useMemo(
    () =>
      pasKeuzesToe(
        ledenKey ? ledenKey.split(",") : [],
        defaultKey ? defaultKey.split(",") : [],
        keuzes,
      ),
    [ledenKey, defaultKey, keuzes],
  );

  /** Eén plek waar een keuze zowel in beeld als in de opslag terechtkomt. */
  const kiesAnders = (volgende: AanwezigKeuzes) => {
    setKeuzes(volgende);
    bewaarKeuzes(groupId, dag, volgende);
  };

  const toggle = (id: string) => {
    kiesAnders({ ...keuzes, [id]: !selected.has(id) });
  };

  /** Alles aan of alles uit: een expliciete keuze over iedereen tegelijk. */
  const kiesAllen = (aan: boolean) => {
    kiesAnders(
      Object.fromEntries(members.map((m) => [m.player_id, aan])),
    );
  };

  // De kiesbare spelers zoals ze in de chips komen te staan. De naam is ook
  // waar de zoekterm op filtert, dus "(jij)" hoort erbij: zo vind je jezelf
  // net zo goed terug als iedere ander.
  const kiesbaar: KiesbareSpeler[] = useMemo(
    () =>
      members.map((m) => ({
        id: m.player_id,
        naam:
          displayName(profiles[m.player_id]) +
          (m.player_id === myId ? " (jij)" : ""),
      })),
    [members, profiles, myId],
  );

  const selectedIds = [...selected];
  const enough = selectedIds.length >= 4;
  const mexicanoBlocked = format === "mexicano" && !!openRound;

  async function generate() {
    setBusy(true);
    try {
      let total = 0;
      if (format === "americano") {
        // Geschiedenis-bewuste indeling over de gekozen deelnemers.
        const history = historyFromMatches(matches, teams);
        for (let i = 0; i < roundsToGen; i++) {
          const { courts } = americanoRound(selectedIds, history);
          if (courts.length === 0) break;
          const ids = await createFairRound(groupId, courts, startVanRonde(i));
          total += ids.length;
          applyRound(history, courts);
        }
      } else {
        const ids = await generateMexicanoRound(groupId, startVanRonde(0));
        total = ids.length;
      }
      if (total === 0) throw new Error("Geen wedstrijden gegenereerd.");
      onGenerated();
      toast.success(
        format === "mexicano"
          ? "Nieuwe Mexicano-ronde gegenereerd."
          : roundsToGen === 1
            ? "Nieuwe Americano-ronde gegenereerd."
            : `${roundsToGen} Americano-rondes gegenereerd.`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* "Wie speelt er mee?" (#1089): de deelnemersselectie is een eigen kaart
          geworden met teller, zoeken, filters en een afwezigen-voet. Hij stond
          hiervoor als platte rij pillen middenin de generatorkaart, waar hij
          bij een groep van twintig als een muur las. */}
      <SpelersKiezer
        spelers={kiesbaar}
        profielen={profiles}
        gekozen={selected}
        moment={gekozen?.option.start_time ?? null}
        herkomst={
          tonightYes
            ? speeldag
              ? "Deelnemers uit de poll van deze speeldag."
              : "Deelnemers uit de poll van vandaag."
            : "Geen poll voor vandaag — alle leden staan aan."
        }
        onToggle={toggle}
        onAlles={kiesAllen}
        onHerstel={() => kiesAllen(true)}
      />

      {/* "Speelformaat" (#1089): de vormkeuze was drie tabs in een kaartkop met
          een losse alinea eronder — je koos zonder te zien wat de vorm met jouw
          groep zou doen. Nu een omgekeerd paneel dat de belofte afmaakt
          (spelers, banen, rondes) met één knop eronder. */}
      <SpeelformaatKaart
        vorm={format}
        onVorm={setFormat}
        aanwezig={selectedIds.length}
        aantalRondes={roundsToGen}
        onAantalRondes={setRoundsToGen}
        bezig={busy}
        blokkade={
          !enough
            ? "Minimaal 4 deelnemers nodig om teams te maken."
            : mexicanoBlocked
              ? `Vul eerst alle uitslagen van ronde ${openRound!.round} in — Mexicano paart op basis van de volledige stand.`
              : null
        }
        onStart={() => {
          // Eerlijk heeft geen generator maar een voorstel: de knop laat het
          // voorstel verschijnen, en daar zit "Speel deze teams" onder.
          if (format === "eerlijk") setEerlijkGevraagd(true);
          else void generate();
        }}
      />

      {/* Eerlijk: het bestaande voorstel-met-voorbeeld, gevoed door de
          deelnemers-selectie hierboven en door de CTA van het paneel. */}
      {format === "eerlijk" && enough && eerlijkGevraagd && (
        <FairTeamsCard
          groupId={groupId}
          playerIds={selectedIds}
          profiles={profiles}
          playedAt={startVanRonde(0)}
          aantal={roundsToGen}
          startVoor={startVanRonde}
          onGenerated={onGenerated}
          ingebed
        />
      )}
    </>
  );
}

export default MakeTeams;
