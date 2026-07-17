import { useState } from "react";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";
import { COMMENTATOR } from "@/features/coach/roastTone";
import { playSfx, sfxAan, setSfxAan } from "@/lib/utils/sfx";
import { tap } from "@/lib/utils/haptics";
import {
  KLIKKER_CATEGORIEEN,
  type KlikkerCategorie,
  type KlikkerQuote,
} from "./klikkerData";
import { WisselGenerator } from "./components/WisselGenerator";
import { SproeierModus } from "./components/SproeierModus";
import "./Klikker.css";

// Rudi's Tactische Klikker (#259/#260): een op zichzelf staand speeltje in het
// Coach Rudy-universum. Vier categorieën tikbare quotes, gepresenteerd als zijn
// beruchte tactische notitieboekje. Tikken speelt een gesynthetiseerd effect
// (sfx.ts) en schrijft de quote "in het boekje" bovenaan.

type Actief = { categorie: KlikkerCategorie; quote: KlikkerQuote };

export function Klikker() {
  const [actief, setActief] = useState<Actief | null>(null);
  const [geluid, setGeluid] = useState(sfxAan);

  const tik = (categorie: KlikkerCategorie, quote: KlikkerQuote) => {
    tap();
    playSfx(quote.sfx);
    setActief({ categorie, quote });
  };

  const toggleGeluid = () => {
    const aan = !geluid;
    setSfxAan(aan);
    setGeluid(aan);
    if (aan) playSfx("pen");
  };

  return (
    <div className="klikker">
      <header className="page-head klikker__head">
        <div className="klikker__head-tekst">
          <h1 className="page-title">Rudi's Tactische Klikker</h1>
          <p className="klikker__intro">
            Het notitieboekje van {COMMENTATOR.naam}, eindelijk openbaar. Tik op
            een tactiek en hoor de bondscoach-in-ruste op zijn best.
          </p>
        </div>
        <button
          type="button"
          className="klikker__geluid"
          onClick={toggleGeluid}
          aria-pressed={geluid}
          title={geluid ? "Geluid uitzetten" : "Geluid aanzetten"}
        >
          {geluid ? "🔊" : "🔇"}
          <span className="klikker__geluid-label">{geluid ? "Geluid aan" : "Geluid uit"}</span>
        </button>
      </header>

      {/* Het "boekje": hier verschijnt de laatst getikte quote. aria-live zodat
          schermlezers de nieuwe notitie horen zonder focus te verleggen. */}
      <section className="klikker-notitie" aria-live="polite">
        {actief ? (
          <div className="klikker-notitie__inhoud" key={actief.quote.id}>
            <CoachAvatar size={44} mood={actief.categorie.mood} className="klikker-notitie__face" />
            <div className="klikker-notitie__tekst">
              <span className="klikker-notitie__kop">
                {actief.categorie.emoji}{" "}
                {actief.quote.sfxTitel ? (
                  <em>[{actief.quote.titel}]</em>
                ) : (
                  <span className="klikker-fluo">{actief.quote.titel}</span>
                )}
              </span>
              <p className="klikker-notitie__quote">“{actief.quote.tekst}”</p>
            </div>
          </div>
        ) : (
          <div className="klikker-notitie__inhoud klikker-notitie__inhoud--leeg">
            <CoachAvatar size={44} mood="portret" fixed className="klikker-notitie__face" />
            <p className="klikker-notitie__leeg">
              Deze pagina is nog leeg. Tik hieronder op een tactiek…
            </p>
          </div>
        )}
      </section>

      {KLIKKER_CATEGORIEEN.map((categorie) => (
        <section key={categorie.id} className="klikker-categorie">
          <h2 className="klikker-categorie__titel">
            <span aria-hidden="true">{categorie.emoji}</span> {categorie.titel}
          </h2>
          <div className="klikker-categorie__grid">
            {categorie.quotes.map((quote) => (
              <button
                key={quote.id}
                type="button"
                className={`klikker-knop${actief?.quote.id === quote.id ? " is-actief" : ""}`}
                onClick={() => tik(categorie, quote)}
              >
                {quote.sfxTitel ? <em>[{quote.titel}]</em> : quote.titel}
              </button>
            ))}
          </div>
        </section>
      ))}

      <WisselGenerator />
      <SproeierModus />
    </div>
  );
}

export default Klikker;
