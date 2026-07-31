import { useState } from "react";
import type { GroupMember, Profile } from "@/types";
import type {
  PlayPoll,
  PollOption,
  PollVote,
} from "@/features/groups/pollsApi";
import { pollOptions } from "@/features/groups/pollLogic";
import { lockedOptionOf } from "../planFlowLogic";
import { shortDay } from "../planPollHelpers";
import { PollCard } from "./PollCard";

/* ------------------------------------------------------------------ */
/* Eén sectie van de Plannen-tab (#721): "Vastgelegd" of "Stemmen      */
/* loopt". Gegroeid uit OtherPollsList (#349), dat álle niet-focus-     */
/* polls in één dichtgeklapte restlijst duwde — inclusief de geboekte   */
/* speeldag die je juist zocht.                                         */
/*                                                                      */
/* Eén speeldag in de sectie → meteen de volledige kaart: er valt niets */
/* te kiezen, dus een rij erboven zou de datum alleen verdubbelen. Meer */
/* speeldagen → elk een rij met datum en status (zonder uitklappen te   */
/* lezen), waarvan er één openstaat.                                    */
/* ------------------------------------------------------------------ */

const STATUS_BADGE: Record<PlayPoll["status"], string> = {
  open: "stemmen loopt",
  locked: "gekozen",
  booked: "geboekt ✓",
  cancelled: "geannuleerd",
};

export type PlanSectionProps = {
  title: string;
  polls: PlayPoll[];
  options: PollOption[];
  votes: PollVote[];
  groupName: string;
  members: GroupMember[];
  profiles: Record<string, Profile>;
  myId: string;
  isOwner: boolean;
  onChanged: () => void;
  /** Welke speeldag standaard openstaat; valt terug op de eerste. */
  openId?: string | null;
  /** Speeldag waarop een gedeelde link je liet landen (#886): die kaart brengt
   *  zichzelf in beeld en licht kort op. Null bij een gewoon bezoek. */
  spotlightId?: string | null;
  /** Polls waarop deze speler nog niet stemde — krijgen een eigen badge. */
  wachtOpJou?: Set<string>;
  /** Er staan al rondes klaar voor deze geboekte speeldag (#349). */
  roundsExist?: (poll: PlayPoll) => boolean;
  /** Aantal rondes dat al klaarstaat — bepaalt de starttijden (#827). */
  rondesVandaag?: (poll: PlayPoll) => number;
  onRoundsMade?: (poll: PlayPoll) => void;
};

export function PlanSection({
  title,
  polls,
  options,
  votes,
  groupName,
  members,
  profiles,
  myId,
  isOwner,
  onChanged,
  openId,
  spotlightId,
  wachtOpJou,
  roundsExist,
  rondesVandaag,
  onRoundsMade,
}: PlanSectionProps) {
  // null = volg de standaardkeuze (de gedeelde link of de eerste rij); een
  // string = de gebruiker koos zelf een rij; "" = alles dichtgeklapt.
  const [gekozen, setGekozen] = useState<string | null>(null);

  if (polls.length === 0) return null;

  const standaard = polls.some((p) => p.id === openId) ? openId! : polls[0].id;
  const openPoll = gekozen ?? standaard;
  const solo = polls.length === 1;

  const kaart = (p: PlayPoll) => (
    <PollCard
      poll={p}
      groupName={groupName}
      members={members}
      options={pollOptions(p, options)}
      votes={votes}
      profiles={profiles}
      myId={myId}
      isOwner={isOwner}
      onChanged={onChanged}
      spotlight={spotlightId != null && p.id === spotlightId}
      roundsExist={roundsExist?.(p)}
      rondesVandaag={rondesVandaag?.(p)}
      onRoundsMade={onRoundsMade ? () => onRoundsMade(p) : undefined}
    />
  );

  return (
    <section className="plan-section">
      <h2 className="plan-section__title">
        {title}
        {!solo && <span className="plan-section__count">{polls.length}</span>}
      </h2>

      {solo ? (
        kaart(polls[0])
      ) : (
        <ul className="plan-other__rows">
          {polls.map((p) => {
            const own = pollOptions(p, options);
            const chosen = lockedOptionOf(p, options);
            const eerste = chosen ?? own[0] ?? null;
            const laatste = own[own.length - 1] ?? null;
            const expanded = openPoll === p.id;
            // Zonder gekozen moment vat een reeks opties samen als bereik:
            // "ma 4 aug – do 7 aug" zegt meer dan alleen de eerste dag.
            const wanneer = !eerste
              ? "Nog geen momenten"
              : chosen || own.length === 1 || !laatste || laatste.id === eerste.id
                ? `${shortDay(eerste.date)} · ${eerste.start_time}`
                : `${shortDay(eerste.date)} – ${shortDay(laatste.date)}`;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className="plan-other__row"
                  aria-expanded={expanded}
                  onClick={() => setGekozen(expanded ? "" : p.id)}
                >
                  <span className="plan-other__when">{wanneer}</span>
                  {wachtOpJou?.has(p.id) && (
                    <span className="plan-other__badge is-jij">
                      jij moet nog stemmen
                    </span>
                  )}
                  <span className={`plan-other__badge is-${p.status}`}>
                    {STATUS_BADGE[p.status]}
                  </span>
                  <span className="plan-other__chevron" aria-hidden="true">
                    ⌄
                  </span>
                </button>
                {expanded && kaart(p)}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default PlanSection;
