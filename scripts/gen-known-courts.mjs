// Genereert src/features/availability/knownCourts.ts vanaf de live
// Playtomic-clubpagina (#392). Het availability-endpoint geeft alleen
// resource_id's; de namen en dak-/buitentypes staan wél in de server-gerenderde
// clubpagina (RSC-payload met een "resources"-array). Dit script haalt die op,
// leidt de mapping af en schrijft het bestand deterministisch opnieuw —
// wijzigingen zijn dus als git-diff te reviewen, en de wekelijkse workflow
// (.github/workflows/known-courts.yml) opent bij drift automatisch een PR.
//
// Gebruik: node scripts/gen-known-courts.mjs   (of: npm run gen:courts)
// Faalt hard (exit 1) als de pagina niet te halen of te parsen is; het
// bestaande bestand blijft dan onaangeroerd.

import { writeFileSync } from "node:fs";

// Clubs om te genereren. De slug wordt live geresolvd via de
// playtomic.io-redirect (slugs kunnen wijzigen); fallbackSlug vangt op als
// die redirect ooit hapert.
const CLUBS = [
  {
    tenantId: "91d8d419-3736-498e-90be-362de786d588",
    name: "LAGO CLUB Padel Beveren",
    fallbackSlug: "lago-club-padel-beveren",
  },
];

const OUTPUT_URL = new URL(
  "../src/features/availability/knownCourts.ts",
  import.meta.url,
);

// Browser-achtige headers: de clubpagina is publiek (robots.txt staat /clubs/
// toe), maar een kale library-UA is onnodig opvallend.
const PAGE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8",
};

/** Canonieke slug via de 308 van playtomic.io (zie handleClubSlug in
 *  worker/index.js); null als er geen bruikbare redirect komt. */
async function resolveSlug(tenantId) {
  try {
    const res = await fetch(`https://playtomic.io/clubs/${tenantId}`, {
      redirect: "manual",
      headers: { "Accept-Language": PAGE_HEADERS["Accept-Language"] },
    });
    const location = res.headers.get("location");
    const slug = /\/clubs\/([^/?#]+)/.exec(location ?? "")?.[1];
    return slug && slug !== tenantId ? slug : null;
  } catch {
    return null;
  }
}

/**
 * Decodeert de `self.__next_f.push([1,"…"])`-chunk (een JS-stringliteral,
 * dus met \" ge-escapete JSON) waarin `marker` (ge-escapet) voorkomt.
 */
function extractFlightString(html, marker) {
  const escapedMarker = marker.replaceAll('"', '\\"');
  const at = html.indexOf(escapedMarker);
  if (at === -1) {
    throw new Error(`marker ${marker} niet gevonden in de pagina`);
  }
  const pushStart = html.lastIndexOf('self.__next_f.push([1,"', at);
  if (pushStart === -1) {
    throw new Error("geen __next_f.push-chunk vóór de marker gevonden");
  }
  const strStart = html.indexOf('"', pushStart) + 1;
  // Zoek het niet-ge-escapete slotcitaat: een " met een even aantal
  // backslashes ervoor sluit de JS-string.
  for (let i = strStart; i < html.length; i++) {
    if (html[i] !== '"') continue;
    let backslashes = 0;
    for (let j = i - 1; html[j] === "\\"; j--) backslashes++;
    if (backslashes % 2 === 0) {
      // JSON.parse van de her-omhulde literal handelt alle escapes af.
      return JSON.parse(`"${html.slice(strStart, i)}"`);
    }
  }
  throw new Error("einde van de __next_f-chunk niet gevonden");
}

/** Balanced capture van een JSON-array vanaf `from` (wijst naar '['),
 *  string-bewust zodat haken binnen namen niet meetellen. */
function captureArray(text, from) {
  let depth = 0;
  let inString = false;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === "[") {
      depth++;
    } else if (c === "]" && --depth === 0) {
      return text.slice(from, i + 1);
    }
  }
  throw new Error("resources-array niet afgesloten");
}

/**
 * resource_id → naam/type uit de clubpagina-HTML. Het type volgt uit de
 * features-array ("roofed"/"outdoor" — er is geen boolean); namen verliezen
 * hun "(overdekt)"-achtige suffix, want het type-veld dekt dat al (icoon +
 * label in de UI) en de deelteksten gebruiken de kale namen.
 */
export function parseResources(html) {
  const marker = '"resources":[';
  const flight = extractFlightString(html, marker);
  const at = flight.indexOf(marker);
  if (at === -1) throw new Error(`${marker} niet in de gedecodeerde chunk`);
  const resources = JSON.parse(
    captureArray(flight, at + marker.length - 1),
  );
  const courts = resources
    .filter((r) => r.sport === "PADEL")
    .map((r) => {
      const type = r.features?.includes("roofed")
        ? "roofed"
        : r.features?.includes("outdoor")
          ? "outdoor"
          : "";
      if (type === "") {
        console.warn(
          `waarschuwing: geen roofed/outdoor-feature voor ${r.name} (${r.resourceId})`,
        );
      }
      return {
        id: r.resourceId,
        name: r.name.replace(/\s*\([^)]*\)\s*$/, ""),
        type,
      };
    });
  if (courts.length === 0) {
    throw new Error("0 padelbanen gevonden — paginavorm gewijzigd?");
  }
  return courts;
}

/**
 * Rendert de volledige inhoud van knownCourts.ts. Deterministisch — bewust
 * géén timestamp, anders zou elke run diffen en is de wekelijkse driftcheck
 * (git diff) waardeloos.
 */
export function renderKnownCourts(clubs) {
  const entries = clubs
    .map(({ name, tenantId, courts }) => {
      const roofed = courts.filter((c) => c.type === "roofed").length;
      const outdoor = courts.filter((c) => c.type === "outdoor").length;
      const rows = courts
        .map(
          (c) =>
            `    { id: "${c.id}", name: "${c.name}", type: "${c.type}" },`,
        )
        .join("\n");
      return `  // ${name} — ${roofed} overdekte ${roofed === 1 ? "baan" : "banen"} + ${outdoor} ${outdoor === 1 ? "buitenbaan" : "buitenbanen"}.\n  "${tenantId}": [\n${rows}\n  ],`;
    })
    .join("\n");
  return `// Baannamen + types per Playtomic-tenant.
//
// Het beschikbaarheidsendpoint (playtomic.com/api/clubs/availability) geeft
// alleen resource_id's terug, geen namen of types meer (#385). Voor de
// thuisclub houden we daarom deze snapshot bij, zodat het raster dezelfde
// labels en dak-/zon-iconen toont als voorheen. Onbekende clubs (en clubs
// zonder entry) vallen terug op genummerde labels "Terrein N" zonder type —
// zie getClubAvailability in api.ts.
//
// GEGENEREERD BESTAND (#392): niet met de hand bewerken. Bijwerken kan met
// \`npm run gen:courts\` (scripts/gen-known-courts.mjs), dat de mapping van de
// live Playtomic-clubpagina afleidt; de wekelijkse workflow
// .github/workflows/known-courts.yml opent bij drift automatisch een PR.
// type: "roofed" = overdekt, "outdoor" = buiten (zie courtTypeLabel /
// CourtTypeIcon).

export type KnownCourt = {
  id: string;
  name: string;
  type: "roofed" | "outdoor" | "";
};

export const KNOWN_COURTS: Record<string, KnownCourt[]> = {
${entries}
};
`;
}

async function main() {
  const clubs = [];
  for (const club of CLUBS) {
    const slug = (await resolveSlug(club.tenantId)) ?? club.fallbackSlug;
    const url = `https://playtomic.com/clubs/${slug}`;
    const res = await fetch(url, { headers: PAGE_HEADERS });
    if (!res.ok) {
      throw new Error(`${url} → HTTP ${res.status}`);
    }
    const courts = parseResources(await res.text());
    console.log(
      `${club.name}: ${courts.length} banen (${courts.map((c) => `${c.name}=${c.type || "?"}`).join(", ")})`,
    );
    clubs.push({ ...club, courts });
  }
  writeFileSync(OUTPUT_URL, renderKnownCourts(clubs));
  console.log(`geschreven: ${OUTPUT_URL.pathname}`);
}

// Alleen draaien als script, niet bij import in tests.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error(`gen-known-courts: ${err.message}`);
    process.exit(1);
  });
}
