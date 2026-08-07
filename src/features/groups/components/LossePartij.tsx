import { useState } from "react";
import {
  NewMatchSheet,
  type NewMatchMode,
} from "@/features/matches/components/NewMatchSheet";
import type { Profile, RoastIntensiteit } from "@/types";
import "./LossePartij.css";

// "Losse partij": een match binnen de groep die buiten de rondes om gespeeld
// of gepland wordt (#722). Kop en woordkeuze gelijk aan de Losse match-kaart op
// de hub (#674 B5) — het bleef hetzelfde ding, maar het heette hier anders.
//
// De gedempte, gestippelde stijl is bewust: hij mag opvallen door zijn plek,
// niet door zijn kleur, zodat de wedstrijden eronder het accent houden.
//
// Sinds #1133 staat hij ook op de speeldagpagina, waar het tijdstip is
// voorgevuld met het moment van díe speeldag. Vandaar dat dit blok een eigen
// component is in plaats van een stuk JSX in VandaagTab.

export function LossePartij({
  groupId,
  players,
  intensiteit,
  busy = false,
  moment,
  standaardModus = "score",
  onCreated,
  onGuestCreated,
}: {
  groupId: string;
  /** Kiesbare spelers: de groepsleden als profiel. */
  players: Profile[];
  intensiteit: RoastIntensiteit;
  busy?: boolean;
  /** Voorgevuld tijdstip (datetime-local) bij het plannen; null = leeg, dus
   *  "nu" zoals de sheet altijd deed. */
  moment?: string | null;
  /** Waarop de knoppen mikken: een dag in de toekomst plan je, een dag die
   *  loopt of geweest is log je. */
  standaardModus?: NewMatchMode;
  onCreated: () => void;
  onGuestCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [modus, setModus] = useState<NewMatchMode>(standaardModus);

  const openMet = (m: NewMatchMode) => {
    setModus(m);
    setOpen(true);
  };

  // De voor de hand liggende actie staat vooraan: op een dag die nog moet
  // komen is dat plannen, op een dag die loopt of geweest is loggen.
  const knoppen: NewMatchMode[] =
    standaardModus === "plan" ? ["plan", "score"] : ["score", "plan"];

  return (
    <>
      <section className="group-log" aria-labelledby="group-log-title">
        <div className="group-log__intro">
          <h3 className="group-log__title" id="group-log-title">
            Losse partij
          </h3>
          <p className="group-log__hint">
            Buiten de rondes om gespeeld of eentje inplannen? Telt gewoon mee in
            de groepsstand en de avondsamenvatting.
          </p>
        </div>
        <div className="group-log__actions">
          {knoppen.map((m) => (
            <button
              key={m}
              className="btn btn--sm"
              disabled={busy}
              onClick={() => openMet(m)}
            >
              {m === "score" ? "+ Match loggen" : "Match plannen"}
            </button>
          ))}
        </div>
      </section>

      <NewMatchSheet
        open={open}
        players={players}
        mode={modus}
        groupId={groupId}
        intensiteit={intensiteit}
        whenDefault={moment ?? null}
        onClose={() => setOpen(false)}
        onCreated={onCreated}
        onGuestCreated={onGuestCreated}
      />
    </>
  );
}

export default LossePartij;
