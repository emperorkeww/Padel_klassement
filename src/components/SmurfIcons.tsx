// Smurf-iconenpakket (issue #134): zelfde line-stijl als de nav-iconen in
// DashboardLayout (24×24, currentColor, strokeWidth 1.8) zodat de navigatie
// niet "danst" bij het wisselen. De paddenstoel is fill-stijl (zoals BallIcon)
// met vaste kleuren — het grote themamoment op de home-knop en het logo.
import { useTheme } from "../lib/theme";
import { BallIcon } from "./BallIcon";

const LINE = {
  viewBox: "0 0 24 24",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Paddenstoelhuisje: bolle hoed met stippen, huisje met deurtje. */
export function IconMushroomHouse() {
  return (
    <svg {...LINE} aria-hidden="true">
      <path d="M3.5 10.5C3.5 6.4 7.3 3 12 3s8.5 3.4 8.5 7.5c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5Z" />
      <circle cx="8.6" cy="7.6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="6.2" r="0.9" fill="currentColor" stroke="none" />
      <path d="M6 12v5.5A3.5 3.5 0 0 0 9.5 21h5a3.5 3.5 0 0 0 3.5-3.5V12" />
      <path d="M10.4 21v-3.2a1.6 1.6 0 0 1 3.2 0V21" />
    </svg>
  );
}

/** Smurfenmuts: phrygische muts met voorover geknikte punt en omslagrand. */
export function IconSmurfHat() {
  return (
    <svg {...LINE} aria-hidden="true">
      <path d="M6 16.5c0-6 2.8-10 7-10 3.2 0 5.5 2 5.5 4.4 0 1.9-2 2.9-3.4 1.7" />
      <path d="M15.1 12.6c.6 1.2.9 2.5.9 3.9" />
      <path d="M4.5 16.5h13a1.5 1.5 0 0 1 0 3h-13a1.5 1.5 0 0 1 0-3Z" />
    </svg>
  );
}

/** Muts + plus: mede-smurf toevoegen. */
export function IconSmurfHatPlus() {
  return (
    <svg {...LINE} aria-hidden="true">
      <path d="M4 15.5c0-4.8 2.3-8 5.7-8 2.6 0 4.4 1.6 4.4 3.6 0 1.5-1.6 2.3-2.8 1.4" />
      <path d="M11.4 12.4c.5 1 .7 2 .7 3.1" />
      <path d="M3 15.5h10.5a1.25 1.25 0 0 1 0 2.5H3a1.25 1.25 0 0 1 0-2.5Z" />
      <path d="M18.5 8v6M15.5 11h6" />
    </svg>
  );
}

/** Vogeltje (dorpsbode): rond lijfje, kopje met snavel, staartveer. */
export function IconBird() {
  return (
    <svg {...LINE} aria-hidden="true">
      <path d="M8.5 19.5c4.8 0 8-2.8 8-7.5v-1.5a3.75 3.75 0 0 0-7.5 0v3c0 2.6-1.7 4.7-4.5 5.4 1.2.4 2.6.6 4 .6Z" />
      <circle cx="14.2" cy="9.2" r="0.9" fill="currentColor" stroke="none" />
      <path d="M16.5 10.5l3 1-3 1" />
      <path d="M10 20.5v-1.6M12.8 20.5v-1.9" />
    </svg>
  );
}

/** Paddenstoel in fill-stijl (zoals BallIcon): rode hoed, witte stippen. */
export function MushroomIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M9.2 12.5V17a2.8 2.8 0 0 0 5.6 0v-4.5Z"
        fill="#f6ead8"
        stroke="#d9c4a3"
        strokeWidth="1"
      />
      <path
        d="M12 3c-5.1 0-9.2 3.5-9.2 7.7 0 1 .8 1.8 1.8 1.8h14.8c1 0 1.8-.8 1.8-1.8C21.2 6.5 17.1 3 12 3Z"
        fill="#e4483b"
      />
      <circle cx="8.3" cy="7.6" r="1.3" fill="#ffffff" />
      <circle cx="13.6" cy="5.9" r="1" fill="#ffffff" />
      <circle cx="16.4" cy="8.9" r="1.2" fill="#ffffff" />
    </svg>
  );
}

/** Het app-logo: padelbal, of de paddenstoel in het smurf-thema. */
export function ThemedBallIcon({ size = 22 }: { size?: number }) {
  const theme = useTheme();
  return theme === "smurf" ? (
    <MushroomIcon size={size} />
  ) : (
    <BallIcon size={size} />
  );
}
