// "Hoe werkt het?" (#989): één pagina waar Coach Rudy de hele app uitlegt.
//
// De uitleg zat versnipperd over de onboarding-checklist, de divisie-legenda
// (#127), de kaartenlegenda (#763) en de Rudy-uitleg in de instellingen (#212);
// wie iets niet snapte moest raden of het in de groepsapp vragen. Hier staat
// alles bij elkaar, met een deep-link per sectie zodat de vraagteken-ingangen
// elders in de app hierheen kunnen wijzen in plaats van hun eigen uitleg te
// dupliceren.
//
// Twee regels waar deze pagina zich aan houdt:
//  1. Rudy zet de toon, hij vervángt de informatie niet. Elke sectie opent met
//     één regel van hem; de nuchtere uitleg staat eronder, zodat wie snel een
//     antwoord zoekt niet door een grap heen hoeft te lezen.
//  2. Niets wordt overgetypt. De divisies, kaart-edities en Rudy's eigen
//     bediening komen uit dezelfde componenten die de app zelf gebruikt, zodat
//     de uitleg niet stil gaat liegen zodra er een tier of editie bijkomt.

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { getProfile, displayName } from "@/features/profiles/api";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import {
  coachUitlegRegel,
  uitlegMood,
  uitlegSeed,
  type UitlegSleutel,
} from "@/features/coach/coachUitleg";
import type { RoastCtx } from "@/features/coach/roastTone";
import { GEVULDE_SECTIES, SECTIE_INHOUD } from "./inhoud";
import { SECTIES, sectieHref } from "./secties";
import "./Uitleg.css";

// Eén rondleiding-beurt per bezoek (mount), zoals de buig-rotatie op het
// klassement (#535): een tweede bezoek schuift de regels een plek op, zodat je
// niet exact dezelfde rondleiding krijgt. Stabiel over re-renders.
let rondleidingBeurt = 0;

// SECTIES kent alle vijftien uit #989; het register in ./inhoud bepaalt welke
// daarvan vandaag écht inhoud hebben. Wat er nog niet is hoort ook niet als
// lege belofte in de inhoudsopgave te staan. Een sectie invullen gebeurt dus
// volledig in ./inhoud — deze pagina hoeft er niets van te weten.
const ZICHTBAAR = SECTIES.filter((s) => GEVULDE_SECTIES.includes(s.id));
const SLEUTELS: readonly UitlegSleutel[] = ["intro", ...ZICHTBAAR.map((s) => s.id)];

export function Uitleg() {
  const { user } = useAuth();
  const { hash } = useLocation();
  const myId = user?.id ?? "";
  const profile = useAsync(
    () => (myId ? getProfile(myId) : Promise.resolve(null)),
    [myId],
  );
  const me = profile.data ?? null;

  // Rudy's toon volgt de persoonlijke instellingen van de kijker: dit is geen
  // groepsoppervlak, dus de groeps-intensiteit speelt hier niet mee. Schild aan
  // of "mild" → de vriendelijke gids (zie coachUitleg.ts).
  const ctx: RoastCtx = useMemo(
    () => ({
      intensiteit: me?.roast_intensiteit ?? "radioactief",
      schild: me?.roast_schild ?? false,
    }),
    [me?.roast_intensiteit, me?.roast_schild],
  );
  const [beurt] = useState(() => rondleidingBeurt++);

  // Alle regels in één keer, met een gedeelde gebruikt-set: binnen één weergave
  // mag Rudy zichzelf niet herhalen (kiesUniek, #201).
  const regels = useMemo(() => {
    const gebruikt = new Set<string>();
    return new Map(
      SLEUTELS.map((sleutel) => [
        sleutel,
        coachUitlegRegel(sleutel, ctx, uitlegSeed(sleutel, beurt), gebruikt),
      ]),
    );
  }, [ctx, beurt]);

  // Landen op /uitleg#kaarten moet ook werken als de pagina lazy geladen is: de
  // browser heeft dan al gescrold voordat de sectie bestond. Zelfde
  // jsdom-guard als PageTabs — scrollIntoView bestaat daar niet.
  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Focus mee verplaatsen, anders staat een toetsenbordgebruiker nog bovenaan
    // terwijl het beeld al verderop is (#924).
    el.focus({ preventScroll: true });
  }, [hash]);

  const naam = me ? displayName(me) : "Jij";
  const mood = uitlegMood(ctx);

  return (
    <div className="uitleg">
      <h1 className="page-title">Hoe werkt het?</h1>
      <p className="page-subtitle">
        Alles wat deze app doet, uitgelegd door de coach zelf.
      </p>

      <div className="uitleg__intro">
        <CoachBubble mood={mood} size={44}>
          <span className="coach-sneer__text">{regels.get("intro")}</span>
        </CoachBubble>
      </div>

      <nav className="card uitleg__toc" aria-labelledby="uitleg-toc-kop">
        <h2 className="card__title card__title--tight" id="uitleg-toc-kop">
          Inhoud
        </h2>
        <ul className="uitleg__toc-lijst">
          {ZICHTBAAR.map((s) => (
            <li key={s.id}>
              <Link className="uitleg__toc-link" to={sectieHref(s.id)}>
                <span className="uitleg__toc-emoji" aria-hidden="true">
                  {s.emoji}
                </span>
                <span className="uitleg__toc-tekst">
                  <span className="uitleg__toc-titel">{s.titel}</span>
                  <span className="uitleg__toc-sub">{s.samenvatting}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {ZICHTBAAR.map((s) => {
        const Inhoud = SECTIE_INHOUD[s.id]!;
        return (
          <section
            key={s.id}
            id={s.id}
            className="card uitleg__sectie"
            aria-labelledby={`${s.id}-kop`}
            tabIndex={-1}
          >
            <h2 className="card__title" id={`${s.id}-kop`}>
              <span aria-hidden="true">{s.emoji}</span> {s.titel}
            </h2>
            <CoachBubble mood={mood} size={30}>
              <span className="coach-sneer__text">{regels.get(s.id)}</span>
            </CoachBubble>
            <div className="uitleg__body">
              <Inhoud naam={naam} profile={me ?? undefined} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default Uitleg;
