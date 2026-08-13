/**
 * De negen soort-iconen van de meldingenlijst (#1273).
 *
 * Line-stijl op currentColor, net als IconBel en de navigatie-iconen: de kleur
 * komt van de icoonkolom eromheen, zodat één set iconen in beide thema's en op
 * elke accentfamilie werkt. Emoji waren geen optie — die staan al toevallig in
 * de servertitels (roast.ts rouleert de pools), en juist dáárom kan een emoji
 * geen betekenis dragen: hij is de ene keer wel en de andere keer niet aanwezig.
 */

function Svg({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </svg>
  );
}

/** Nieuwe ronde: een bal met de naad erin. */
export function IconRonde() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M5 6.5c3.2 2 4.6 6.6 3.4 11" />
      <path d="M19 6.5c-3.2 2-4.6 6.6-3.4 11" />
    </Svg>
  );
}

/** Poll: een kalenderblad — de poll gaat altijd over een dag. */
export function IconPoll() {
  return (
    <Svg>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      <path d="M8 13.5h3M8 16.5h8" />
    </Svg>
  );
}

/** VAR: het scherm waar het punt op teruggekeken wordt. */
export function IconVar() {
  return (
    <Svg>
      <rect x="2.5" y="4.5" width="19" height="13" rx="2.5" />
      <path d="M8 21h8M12 17.5V21" />
      <path d="m10.5 8.8 4 2.4-4 2.4z" />
    </Svg>
  );
}

/** Uitslag: het vinkje van een genoteerde stand. */
export function IconUitslag() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.2 12.2 2.6 2.6 5-5.4" />
    </Svg>
  );
}

/** Rangwissel: twee pijlen die van plek ruilen. */
export function IconRang() {
  return (
    <Svg>
      <path d="M8 20V5m0 0L4.5 8.5M8 5l3.5 3.5" />
      <path d="M16 4v15m0 0 3.5-3.5M16 19l-3.5-3.5" />
    </Svg>
  );
}

/** Vriendschapsverzoek: iemand die erbij wil. */
export function IconVriend() {
  return (
    <Svg>
      <circle cx="9.5" cy="8.5" r="3.5" />
      <path d="M3.5 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M18.5 8v5M21 10.5h-5" />
    </Svg>
  );
}

/** Speeldag-herinnering: de klok die tikt. */
export function IconHerinnering() {
  return (
    <Svg>
      <circle cx="12" cy="12.5" r="8" />
      <path d="M12 8v4.5l3 2" />
      <path d="M4.5 4 7 2M19.5 4 17 2" />
    </Svg>
  );
}

/** Lef: het vlammetje van de onthulling. */
export function IconLef() {
  return (
    <Svg>
      <path d="M12 3s5 4 5 8.5a5 5 0 0 1-10 0C7 9 9 7.5 9 7.5s.5 2 1.5 2.5c1-1.5.5-5 1.5-7z" />
      <path d="M12 14.5c1 .6 1.3 1.6.8 2.6" />
    </Svg>
  );
}

/** Pias: de roast — een spraakbel met een steek onder water. */
export function IconPias() {
  return (
    <Svg>
      <path d="M20.5 12c0 4-3.8 7-8.5 7-1 0-2-.1-2.9-.4L4 20l1.4-3.6C4.2 15.2 3.5 13.7 3.5 12c0-4 3.8-7 8.5-7s8.5 3 8.5 7z" />
      <path d="M12 8.5v3.5M12 14.8v.2" />
    </Svg>
  );
}
