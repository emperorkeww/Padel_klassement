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
import { SpelersKiezer } from "@/features/groups/components/SpelersKiezer";
import { SpeelformaatKaart } from "@/features/groups/components/SpeelformaatKaart";
import type { KiesbareSpeler } from "@/features/groups/spelersKiezer";
import type { Speelvorm } from "@/features/groups/speelformaat";
import type { GroupMember, Match, Profile, Team } from "@/types";
import "@/features/groups/Proposals.css";

// "Maak teams": de ene teamgenerator van de groep (#106). Deelnemers komen
// uit het speelvoorstel van vandaag (handmatig bij te sturen), het formaat is
// een keuze — Eerlijk (Elo-gebalanceerd, met voorbeeld), Americano (wisselende
// partners) of Mexicano (paren op de stand). Vervangt de losse "Vanavond"-,
// eerlijke-teams- en Americano/Mexicano-kaarten.

type Format = Speelvorm;

export function MakeTeams({
  groupId,
  members,
  profiles,
  myId,
  matches,
  teams,
  openRound,
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
  onGenerated: () => void;
}) {
  const club = useClub();
  const toast = useToast();
  const today = dateInZone(club.timezone);
  const [format, setFormat] = useState<Format>("eerlijk");
  const [roundsToGen, setRoundsToGen] = useState(1);
  const [busy, setBusy] = useState(false);
  // Eerlijk levert geen ronde maar een voorstel; dat verschijnt pas als je erom
  // vraagt, zodat het paneel niet meteen een half scherm aan teams uitrolt.
  const [eerlijkGevraagd, setEerlijkGevraagd] = useState(false);

  const polls = useAsync<PlayPoll[]>(() => getGroupPolls(groupId), [groupId]);
  const options = useAsync<PollOption[]>(
    () => getGroupPollOptions(groupId),
    [groupId],
  );
  const votes = useAsync(() => getGroupPollVotes(groupId), [groupId]);
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

  const tonightYes = vanavond?.yes ?? null;

  // Starttijd van de eerstvolgende ronde: tien minuten per al klaargezette
  // ronde opschuivend vanaf het gekozen moment.
  const startVanRonde = (index: number): string | null => {
    if (!vanavond) return null;
    const tz = vanavond.poll?.club_timezone ?? club.timezone;
    return rondeStart(
      vanavond.option,
      tz,
      rondesOpDag(matches, club.timezone, today) + index,
    );
  };

  // Handmatig bij te sturen selectie; nieuwe stemmen zijn de bron van
  // waarheid, de toggles een last-minute correctie.
  const defaultKey = (tonightYes ?? members.map((m) => m.player_id)).join(",");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set(defaultKey ? defaultKey.split(",") : []));
  }, [defaultKey]);

  const toggle = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        moment={vanavond?.option.start_time ?? null}
        herkomst={
          tonightYes
            ? "Deelnemers uit de poll van vandaag."
            : "Geen poll voor vandaag — alle leden staan aan."
        }
        onToggle={toggle}
        onAlles={(aan) =>
          setSelected(new Set(aan ? members.map((m) => m.player_id) : []))
        }
        onHerstel={() =>
          setSelected(new Set(members.map((m) => m.player_id)))
        }
      />

      {/* "Speelformaat" (#1089): de vormkeuze was drie tabs in een kaartkop met
          een losse alinea eronder — je koos zonder te zien wat de vorm met jouw
          groep zou doen. Nu een omgekeerd paneel dat de belofte afmaakt
          (spelers, banen, rondes) met één knop eronder. */}
      <SpeelformaatKaart
        vorm={format}
        onVorm={setFormat}
        aanwezig={selectedIds.length}
        americanoRondes={roundsToGen}
        onAmericanoRondes={setRoundsToGen}
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
          ingebed
        />
      )}
    </>
  );
}

export default MakeTeams;
