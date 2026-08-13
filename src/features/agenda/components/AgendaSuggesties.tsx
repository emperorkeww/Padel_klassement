import { useId, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { getGroupMatches } from "@/features/matches/api";
import {
  getGroupPollOptions,
  getGroupPollVotes,
  getGroupPolls,
} from "@/features/groups/pollsApi";
import { SuggestionsCard } from "@/features/groups/components/SuggestionsCard";
import type { GroupSummary } from "@/features/groups/api";

/* ------------------------------------------------------------------ */
/* Suggesties onder het dagpaneel (#1121).                             */
/*                                                                     */
/* De instap die op de Plannen-tab onderaan stond: de beste momenten    */
/* van de komende week, berekend uit vrije banen, wie er kan en de      */
/* speelgewoontes van de groep. Eén tik start er een poll mee.          */
/*                                                                     */
/* Twee dingen die de agenda anders maken dan die tab. Suggesties zijn  */
/* per groep, dus met meerdere groepen kies je er eerst een; die keuze  */
/* is dezelfde als waarvoor je plant, zodat de agenda er maar één kent. */
/* En de kaart gaat pas laden als je hem opent: hij trekt de polls, de  */
/* stemmen én de volledige matchhistoriek van een groep binnen, en dat  */
/* hoort een kalender niet bij elk bezoek te doen.                      */
/* ------------------------------------------------------------------ */

export function AgendaSuggesties({
  groepen,
  groepId,
  onGroep,
  myId,
  onGestart,
}: {
  groepen: GroupSummary[];
  /** De groep waarvoor we plannen; null zolang je er geen koos. */
  groepId: string | null;
  onGroep: (id: string) => void;
  myId: string;
  /** Er is een poll gestart: het maandvenster mag opnieuw geladen worden. */
  onGestart: () => void;
}) {
  const [open, setOpen] = useState(false);
  const laden = open && groepId != null;
  const labelId = useId();

  const polls = useAsync(() => getGroupPolls(groepId ?? ""), [groepId], {
    enabled: laden,
  });
  const opties = useAsync(() => getGroupPollOptions(groepId ?? ""), [groepId], {
    enabled: laden,
  });
  const stemmen = useAsync(() => getGroupPollVotes(groepId ?? ""), [groepId], {
    enabled: laden,
  });
  const matches = useAsync(() => getGroupMatches(groepId ?? ""), [groepId], {
    enabled: laden,
  });

  if (groepen.length === 0) return null;

  return (
    <section className="agenda-suggesties" aria-label="Suggesties">
      {/* Een keuzelijst en geen chiprij (#1270). Dit kreeg in #1182 al een eigen
          label omdat het iets anders doet dan het groepsfilter bovenaan: daar
          zet je er meerdere aan of uit, hier kies je er precies één en die
          bepaalt waarvóór gerekend wordt. Maar het bleef dezelfde vorm met
          dezelfde namen erin, en een label repareert geen vorm die iets anders
          belooft. Een select zegt "precies één" uit zichzelf. */}
      {groepen.length > 1 && (
        <div className="agenda-suggesties__keuze">
          <label className="agenda-suggesties__label" htmlFor={labelId}>
            Suggesties voor
          </label>
          <select
            id={labelId}
            className="select agenda-suggesties__select"
            value={groepId ?? ""}
            onChange={(e) => onGroep(e.target.value)}
          >
            <option value="" disabled>
              Kies een groep
            </option>
            {groepen.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!open ? (
        <button
          type="button"
          className="btn btn--sm agenda-suggesties__open"
          onClick={() => setOpen(true)}
        >
          Suggesties voor een speeldag
        </button>
      ) : groepId == null ? (
        <p className="agenda-suggesties__kies">
          Kies hierboven een groep, dan reken ik de beste momenten uit.
        </p>
      ) : (
        <SuggestionsCard
          groupId={groepId}
          myId={myId}
          matches={matches.data ?? []}
          polls={polls.data ?? []}
          options={opties.data ?? []}
          votes={stemmen.data ?? []}
          onStarted={() => {
            polls.reload();
            opties.reload();
            stemmen.reload();
            onGestart();
          }}
        />
      )}
    </section>
  );
}

export default AgendaSuggesties;
