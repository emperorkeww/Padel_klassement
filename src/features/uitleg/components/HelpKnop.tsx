// De vaste snelkoppeling naar "Hoe werkt het?" (#989). Zonder duidelijke
// ingang is die pagina waardeloos — een link diep in de instellingen telt niet.
// Deze knop staat daarom in de app-shell en is op élk scherm zichtbaar.
//
// Hij springt waar mogelijk naar de sectie die bij het huidige scherm hoort
// (op /klassement → #rating), zodat de snelkoppeling ook nuttig blijft voor wie
// de app al kent. De pad → sectie-tabel staat in secties.ts.

import { Link, useLocation } from "react-router-dom";
import { uitlegHref } from "../secties";
import "./HelpKnop.css";

export function HelpKnop({ className = "" }: { className?: string }) {
  const { pathname } = useLocation();
  return (
    <Link
      to={uitlegHref(pathname)}
      className={`help-knop ${className}`.trim()}
      aria-label="Hoe werkt het?"
      title="Hoe werkt het?"
    >
      <span aria-hidden="true">?</span>
    </Link>
  );
}

export default HelpKnop;
