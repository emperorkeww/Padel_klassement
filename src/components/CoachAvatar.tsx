import { useState } from "react";
import "./CoachAvatar.css";

// Het vaste gezicht van Coach Rudy (#211): een handgetekende illustratie op élk
// coach-oppervlak (feed-bubble, profiel, kennismaking, dashboard, …).
//
// De illustraties staan als losse afbeeldingen in ./rudi_avatars/. Vite pakt ze
// allemaal op via import.meta.glob en bundelt ze (met gehashte URL's), dus zodra
// je een nieuw bestand in die map dropt doet het automatisch mee — geen code
// aanpassen nodig.
const avatarModules = import.meta.glob("./rudi_avatars/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

// Op alfabetische padvolgorde, zodat de cyclus stabiel/voorspelbaar is.
const AVATARS = Object.keys(avatarModules)
  .sort()
  .map((path) => avatarModules[path]);

// Module-level teller: elke nieuw gemounte CoachAvatar pakt de vólgende
// afbeelding, zodat de illustraties netjes door de set heen cyclen i.p.v. overal
// hetzelfde koppie te tonen. Blijft stabiel per instance dankzij useState hieronder.
let nextIndex = 0;

export function CoachAvatar({
  size = 28,
  className,
}: {
  /** Diameter in px. */
  size?: number;
  className?: string;
}) {
  const [src] = useState(() => {
    if (AVATARS.length === 0) return "";
    const picked = AVATARS[nextIndex % AVATARS.length];
    nextIndex += 1;
    return picked;
  });

  return (
    <span
      className={`coach-avatar${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          className="coach-avatar__img"
          src={src}
          width={size}
          height={size}
          alt="Coach Rudy"
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </span>
  );
}

export default CoachAvatar;
