// Wat elke edge function nodig heeft om te werken (#1049).
//
// Waarom dit bestaat: `appeal-deadline` schrijft in zijn eigen kop voor dat hij
// met `--no-verify-jwt` gedeployd moet worden, maar stond niet in config.toml.
// `deploy.yml` draait `supabase functions deploy` zonder vlaggen, dus ging hij
// live met de platformstandaard `verify_jwt = true` en kreeg de pg_cron-post met
// `x-cron-secret` een 401 aan de gateway — vóór de handler. Rudy's VAR (#1025)
// sloot maandenlang geen enkele verlopen zaak af en niets meldde dat.
//
// Twee dingen halen dat uit de anekdote:
//
//  1. edgeFuncties.test.ts leidt de feiten af uit de bron en handhaaft de regel
//     "beveiligt zich met CRON_SECRET => verify_jwt moet false zijn". Dat is de
//     check die het had gevangen, en hij draait nu in CI.
//  2. Het Systeem-tabblad toont deze lijst naast de secrets die het project
//     écht gezet heeft, zodat een ontbrekende sleutel zichtbaar is vóór een
//     speler merkt dat er iets niet meer gebeurt.
//
// LET OP wat dit wél en niet is. `verifyJwt` hieronder is wat de repo
// voorschrijft, niet wat er op dit moment draait — dat laatste zit alleen achter
// de Management API en een persoonlijk toegangstoken. Zolang deploy.yml de
// enige deployroute is, zijn ze gelijk, en dat is precies de aanname die deze
// lijst expliciet maakt.
//
// De secrets zijn projectbreed in Supabase: elke function ziet dezelfde env.
// Daarom kan `admin-users` voor het hele project rapporteren of een sleutel
// gezet is, zonder de andere functions aan te roepen.

/** Door het platform gezet bij elke function; nooit iets om te controleren. */
export const PLATFORM_SECRETS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export interface EdgeFunctie {
  naam: string;
  /**
   * `verify_jwt` uit config.toml. Ontbreekt de function daar, dan geldt de
   * platformstandaard `true`.
   */
  verifyJwt: boolean;
  /** Leest CRON_SECRET en beveiligt zich dus zelf, in de handler. */
  cronGeheim: boolean;
  /** Zonder deze sleutels doet de function zijn werk niet (of half). */
  vereist: readonly string[];
  /** Afstelknoppen met een ingebouwde standaard; afwezig is prima. */
  optioneel: readonly string[];
  /** Eén regel voor het Systeem-tabblad: wat gaat er stuk zonder deze functie. */
  rol: string;
}

export const EDGE_FUNCTIES: readonly EdgeFunctie[] = [
  {
    naam: "admin-content",
    verifyJwt: true,
    cronGeheim: false,
    vereist: [],
    optioneel: [],
    rol: "Beheeracties op matches, groepen en polls (#1159)",
  },
  {
    naam: "admin-users",
    verifyJwt: true,
    cronGeheim: false,
    // Zonder ADMIN_SITE_URL valt de herstel-link terug op http://localhost:5173.
    // Dat faalt niet luid — je deelt gewoon een link uit die bij niemand werkt.
    vereist: ["ADMIN_SITE_URL"],
    optioneel: [],
    rol: "Beheeracties op accounts (#1036)",
  },
  {
    naam: "appeal-deadline",
    verifyJwt: false,
    cronGeheim: true,
    vereist: ["CRON_SECRET"],
    optioneel: [],
    rol: "Rudy's VAR: verlopen beroepszaken afsluiten (#1025)",
  },
  {
    naam: "calendar-feed",
    verifyJwt: false,
    cronGeheim: false,
    // Authenticeert op het feedtoken in de URL, niet op een JWT of een secret.
    vereist: [],
    optioneel: [],
    rol: "ICS-agenda-abonnement (#1099)",
  },
  {
    naam: "client-error",
    verifyJwt: false,
    cronGeheim: true,
    vereist: ["CRON_SECRET"],
    optioneel: [],
    rol: "Crashmeldingen uit de browser wegschrijven (#1049)",
  },
  {
    naam: "club-page",
    verifyJwt: false,
    cronGeheim: true,
    vereist: ["CRON_SECRET"],
    optioneel: [],
    rol: "Clubpagina ophalen buiten de Cloudflare-egress om (#385)",
  },
  {
    naam: "club-search",
    verifyJwt: false,
    cronGeheim: true,
    vereist: ["CRON_SECRET"],
    optioneel: [],
    rol: "Clubs zoeken op naam buiten de Cloudflare-egress om (#391)",
  },
  {
    naam: "generate-dictator-avatar",
    verifyJwt: false,
    cronGeheim: true,
    vereist: ["CRON_SECRET", "OPENAI_API_KEY"],
    optioneel: [],
    rol: "AI-portret van de dictator (#554)",
  },
  {
    naam: "generate-pias-avatar",
    verifyJwt: false,
    cronGeheim: true,
    vereist: ["CRON_SECRET", "OPENAI_API_KEY"],
    optioneel: [],
    rol: "AI-portret van de Pias van de week",
  },
  {
    naam: "match-reminders",
    verifyJwt: false,
    cronGeheim: true,
    vereist: [
      "CRON_SECRET",
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "VAPID_SUBJECT",
    ],
    optioneel: ["REMINDER_HOURS", "LEF_NOTICE_MINUTES"],
    rol: "Herinneringen vóór een wedstrijd",
  },
  {
    naam: "playtomic-availability",
    verifyJwt: false,
    cronGeheim: true,
    vereist: ["CRON_SECRET"],
    optioneel: [],
    rol: "Egress-hop naar Playtomic (#385)",
  },
  {
    naam: "poll-deadline",
    verifyJwt: false,
    cronGeheim: true,
    vereist: [
      "CRON_SECRET",
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "VAPID_SUBJECT",
    ],
    optioneel: [
      "POLL_AUTO_LOCK_HOURS",
      "POLL_DAY_OF_HOURS",
      "POLL_LAST_CALL_HOURS",
      "POLL_ROUNDS_AT",
      "POLL_ROUNDS_LEAD_MIN",
    ],
    rol: "Speeldagen sluiten en rondes indelen (#839)",
  },
  {
    naam: "remind-group",
    verifyJwt: true,
    cronGeheim: false,
    vereist: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"],
    // De rem op het porren (#1273); zonder deze staat hij op een uur.
    optioneel: ["REMIND_COOLDOWN_MIN"],
    rol: "Handmatige por vanuit een groep",
  },
  {
    naam: "send-push",
    verifyJwt: false,
    cronGeheim: true,
    vereist: [
      "CRON_SECRET",
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "VAPID_SUBJECT",
    ],
    optioneel: [],
    rol: "Pushmeldingen vanuit de databank-webhooks",
  },
  {
    naam: "snapshot-availability",
    verifyJwt: false,
    cronGeheim: true,
    vereist: ["CRON_SECRET", "SNAPSHOT_TENANT_ID"],
    optioneel: [],
    rol: "Baanbeschikbaarheid wegschrijven",
  },
];

/** Elke sleutel die ergens vereist of optioneel is, ontdubbeld en gesorteerd. */
export function alleSecrets(): string[] {
  const set = new Set<string>();
  for (const f of EDGE_FUNCTIES) {
    for (const s of f.vereist) set.add(s);
    for (const s of f.optioneel) set.add(s);
  }
  return [...set].sort();
}
