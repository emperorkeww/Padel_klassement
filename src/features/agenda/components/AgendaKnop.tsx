// De ingang naar de Agenda in de mobiele topbalk (#1091).
//
// Op desktop staat Agenda gewoon in de zijbalk; mobiel heeft daar geen plek
// voor. De onderbalk blijft op vijf symmetrische slots rond de bal (#106/#274)
// — dat is een bewuste vorm en geen restruimte — dus de agenda hangt naast de
// joker- en ?-knop in de topbalk, waar hij op élk scherm bereikbaar is.

import { Link, useLocation } from "react-router-dom";
import "./AgendaKnop.css";

export function AgendaKnop({ className = "" }: { className?: string }) {
  const hier = useLocation().pathname === "/agenda";
  return (
    <Link
      to="/agenda"
      className={`agenda-knop ${className}`.trim()}
      aria-label="Naar agenda"
      aria-current={hier ? "page" : undefined}
      title="Agenda"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    </Link>
  );
}

export default AgendaKnop;
