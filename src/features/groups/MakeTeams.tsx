import { useEffect, useMemo, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { dateInZone } from "../../lib/time";
import { useClub } from "../availability/club";
import { displayName } from "../profiles/api";
import {
  americanoRound,
  applyRound,
  historyFromMatches,
} from "../../lib/americano";
import { createFairRound, generateMexicanoRound } from "./api";
import {
  getGroupPolls,
  getGroupPollOptions,
  getGroupPollVotes,
  type PlayPoll,
  type PollOption,
} from "./pollsApi";
import { tallyOption } from "./pollLogic";
import { FairTeamsCard } from "./FairTeams";
import type { GroupMember, Match, Profile, Team } from "../../lib/types";
import "./Proposals.css";

// "Maak teams": de ene teamgenerator van de groep (#106). Deelnemers komen
// uit het speelvoorstel van vandaag (handmatig bij te sturen), het formaat is
// een keuze — Eerlijk (Elo-gebalanceerd, met voorbeeld), Americano (wisselende
// partners) of Mexicano (paren op de stand). Vervangt de losse "Vanavond"-,
// eerlijke-teams- en Americano/Mexicano-kaarten.

type Format = "eerlijk" | "americano" | "mexicano";

const FORMAT_LABEL: Record<Format, string> = {
  eerlijk: "Eerlijk",
  americano: "Americano",
  mexicano: "Mexicano",
};

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

  const polls = useAsync<PlayPoll[]>(() => getGroupPolls(groupId), [groupId]);
  const options = useAsync<PollOption[]>(
    () => getGroupPollOptions(groupId),
    [groupId],
  );
  const votes = useAsync(() => getGroupPollVotes(groupId), [groupId]);
  useRealtime("play_poll_votes", votes.reload, `group_id=eq.${groupId}`);

  // Deelnemers van vandaag: het gekozen/meest gesteunde poll-moment van
  // vandaag; zonder poll vandaag zijn alle leden het vertrekpunt.
  const tonightYes = useMemo(() => {
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
    return best ? tallyOption(best, votes.data ?? []).yes : null;
  }, [polls.data, options.data, votes.data, today]);

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
          const ids = await createFairRound(groupId, courts);
          total += ids.length;
          applyRound(history, courts);
        }
      } else {
        const ids = await generateMexicanoRound(groupId);
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
      <section className="card">
        <div className="card__head">
          <h2 className="card__title card__title--tight">Maak teams</h2>
          <div className="tabs tabs--head" role="group" aria-label="Spelvorm">
            {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => (
              <button
                key={f}
                className={`tab ${format === f ? "is-active" : ""}`}
                onClick={() => setFormat(f)}
              >
                {FORMAT_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        <p className="card__subtitle">
          {format === "eerlijk" &&
            "Elo-gebalanceerde teams uit de deelnemers — bekijk het voorstel hieronder en zet het klaar."}
          {format === "americano" &&
            "Americano: wisselt de teams elke ronde af, zodat je zo veel mogelijk met en tegen verschillende spelers speelt."}
          {format === "mexicano" &&
            "Mexicano: paart op basis van de stand — sterk speelt met zwak, tegen een gelijkwaardig duo."}
        </p>

        <SpelvormUitleg />

        <p className="proposals__hint">
          {tonightYes
            ? "Deelnemers uit de poll van vandaag; tik namen aan of uit om te corrigeren."
            : "Geen poll voor vandaag — alle leden staan aan; tik namen uit die er niet bij zijn."}
        </p>
        <div className="tonight__players" role="group" aria-label="Deelnemers">
          {members.map((m) => {
            const on = selected.has(m.player_id);
            return (
              <button
                key={m.player_id}
                type="button"
                className={`btn btn--sm attendance-btn ${on ? "is-active is-yes" : ""}`}
                aria-pressed={on}
                onClick={() => toggle(m.player_id)}
              >
                {displayName(profiles[m.player_id])}
                {m.player_id === myId ? " (jij)" : ""}
              </button>
            );
          })}
        </div>

        {format !== "eerlijk" && (
          <div className="gen-controls">
            {format === "americano" && (
              <label className="gen-controls__rounds">
                <span>Rondes</span>
                <select
                  className="select"
                  value={roundsToGen}
                  onChange={(e) => setRoundsToGen(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="btn btn--primary"
              disabled={busy || !enough || mexicanoBlocked}
              onClick={generate}
            >
              {format === "americano"
                ? roundsToGen === 1
                  ? "Genereer Americano-ronde"
                  : `Genereer ${roundsToGen} Americano-rondes`
                : "Genereer Mexicano-ronde"}
            </button>
          </div>
        )}

        {!enough && (
          <p className="msg msg--warn">
            Minimaal 4 deelnemers nodig om teams te maken.
          </p>
        )}
        {enough && mexicanoBlocked && (
          <p className="msg msg--warn">
            Vul eerst alle uitslagen van ronde {openRound!.round} in — Mexicano
            paart op basis van de volledige stand.
          </p>
        )}
      </section>

      {/* Eerlijk: het bestaande voorstel-met-voorbeeld, gevoed door de
          deelnemers-selectie hierboven. */}
      {format === "eerlijk" && enough && (
        <FairTeamsCard
          groupId={groupId}
          playerIds={selectedIds}
          profiles={profiles}
        />
      )}
    </>
  );
}

function SpelvormUitleg() {
  return (
    <details className="explainer">
      <summary>Eerlijk, Americano of Mexicano — wat is het verschil?</summary>
      <div className="explainer__body">
        <dl>
          <div>
            <dt>Eerlijk</dt>
            <dd>
              Teams worden <strong>Elo-gebalanceerd</strong> samengesteld:
              sterk speelt met zwak, zodat elke baan een spannende, gelijke
              wedstrijd krijgt. Je ziet eerst een voorstel (met winstkans) en
              zet dat daarna klaar als geplande matches.
            </dd>
          </div>
          <div>
            <dt>Americano</dt>
            <dd>
              Elke ronde krijg je een <strong>andere partner</strong> en andere
              tegenstanders: de indeling houdt rekening met eerdere rondes zodat
              je zo veel mogelijk met en tegen verschillende spelers speelt,
              ongeacht de stand. Gezellig en gelijk verdeeld — ideaal voor een
              ontspannen avond.
            </dd>
          </div>
          <div>
            <dt>Mexicano</dt>
            <dd>
              De volgende ronde wordt <strong>op basis van de stand</strong>{" "}
              gemaakt: spelers worden gerangschikt op punten (en saldo), en per
              baan speelt de <strong>1e met de 4e</strong> tegen de{" "}
              <strong>2e met de 3e</strong>. Zo blijven de wedstrijden spannend
              en in balans. Je kunt pas een nieuwe Mexicano-ronde genereren als{" "}
              <strong>alle uitslagen</strong> van de vorige ronde zijn ingevuld —
              anders zou er op een halve stand gepaird worden.
            </dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

export default MakeTeams;
