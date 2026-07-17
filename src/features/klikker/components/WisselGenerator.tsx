import { useRef, useState } from "react";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";
import { roastSeed } from "@/features/coach/roastTone";
import { playSfx } from "@/lib/utils/sfx";
import { tap } from "@/lib/utils/haptics";
import {
  genereerWissel,
  leegGebruikt,
  type Wissel,
} from "../wisselGenerator";

// De grote rode knop (#261): elke klik een nieuwe absurde wissel, in het
// notitieboekje gekrabbeld. De gebruikt-sets leven in een ref zodat fragmenten
// pas terugkeren als hun pool op is; de vorige zin sluit directe herhaling uit.

export function WisselGenerator() {
  const gebruikt = useRef(leegGebruikt());
  const teller = useRef(0);
  const [wissel, setWissel] = useState<Wissel | null>(null);

  const klik = () => {
    tap();
    playSfx("whistle");
    teller.current += 1;
    const seed = roastSeed(String(Date.now()), String(teller.current));
    setWissel(genereerWissel(seed, gebruikt.current, wissel?.zin));
  };

  return (
    <section className="klikker-categorie wissel-generator">
      <h2 className="klikker-categorie__titel">
        <span aria-hidden="true">🔴</span> De Wissel-Generator
      </h2>
      <p className="wissel-generator__uitleg">
        Vastgelopen match? Druk op de knop en Rudy bedenkt een tactische
        meesterzet. Werkt gegarandeerd. Soms.
      </p>
      <button type="button" className="wissel-generator__knop" onClick={klik}>
        Wissel!
      </button>
      {wissel && (
        <div className="klikker-notitie wissel-generator__uitslag" aria-live="polite">
          <div className="klikker-notitie__inhoud" key={wissel.zin}>
            <CoachAvatar size={44} mood="gemeen" className="klikker-notitie__face" />
            <p className="klikker-notitie__quote">
              Wissel in minuut <span className="klikker-fluo">{wissel.minuut}</span>:{" "}
              <span className="klikker-doorgestreept">{wissel.eraf}</span> eraf,{" "}
              <span className="klikker-fluo">{wissel.erin}</span> erin, {wissel.positie}.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default WisselGenerator;
