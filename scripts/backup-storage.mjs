// Lepelt de avatars-bucket leeg naar een lokale map (#1059). Storage zit niet
// in `supabase db dump`: die dumpt hooguit de rij in storage.objects, niet het
// bestand zelf. Zonder dit script herstel je dus een database die naar
// profielfoto's en dictatorportretten (#554) wijst die nergens meer bestaan.
//
// Gebruik:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_KEY=<anon of service-role key> \
//   node scripts/backup-storage.mjs <doelmap>
//
// De anon-key volstaat om te lezen: de select-policy op de bucket
// ("Avatars zijn publiek leesbaar", 20260701150000_avatars_storage.sql) staat
// lezen toe zonder rolbeperking. Er is dus geen service-role-secret in CI
// nodig — die heb je pas nodig om terúg te zetten, en dan haal je hem met de
// hand uit het dashboard.
//
// Faalt hard (exit 1) zodra één bestand niet te downloaden is: een backup die
// stilletjes de helft overslaat is gevaarlijker dan geen backup.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BUCKET = process.env.BACKUP_BUCKET ?? "avatars";
const doelmap = process.argv[2];

if (!SUPABASE_URL || !SUPABASE_KEY || !doelmap) {
  console.error(
    "Gebruik: SUPABASE_URL=… SUPABASE_KEY=… node scripts/backup-storage.mjs <doelmap>",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

/** Eén pagina-groot venster; list() geeft standaard maar 100 rijen terug. */
const PAGINA = 1000;

/** Alle bestandspaden onder `prefix`, recursief. Mappen bestaan in Storage
 *  alleen als pad-prefix: list() geeft ze terug als entry zónder id. */
async function paden(prefix = "") {
  const gevonden = [];
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGINA, offset, sortBy: { column: "name", order: "asc" } });
    if (error) {
      throw new Error(`Listen van "${prefix || "/"}" mislukte: ${error.message}`);
    }
    for (const entry of data) {
      const pad = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Supabase legt voor elke map een placeholderrij aan met deze naam;
      // die is geen echt bestand en hoort niet in de backup.
      if (entry.name === ".emptyFolderPlaceholder") continue;
      if (entry.id === null) gevonden.push(...(await paden(pad)));
      else gevonden.push({ pad, grootte: entry.metadata?.size ?? null });
    }
    if (data.length < PAGINA) break;
  }
  return gevonden;
}

const bestanden = await paden();
console.log(`${bestanden.length} bestand(en) in bucket "${BUCKET}"`);

let bytes = 0;
for (const { pad } of bestanden) {
  const { data, error } = await supabase.storage.from(BUCKET).download(pad);
  if (error || !data) {
    console.error(`Download van "${pad}" mislukte: ${error?.message ?? "geen data"}`);
    process.exit(1);
  }
  const inhoud = Buffer.from(await data.arrayBuffer());
  const doel = join(doelmap, BUCKET, pad);
  await mkdir(dirname(doel), { recursive: true });
  await writeFile(doel, inhoud);
  bytes += inhoud.byteLength;
}

// Het manifest maakt een restore controleerbaar: na het terugzetten moet elk
// pad hier weer bestaan, met dezelfde grootte.
await mkdir(doelmap, { recursive: true });
await writeFile(
  join(doelmap, `${BUCKET}-manifest.json`),
  `${JSON.stringify({ bucket: BUCKET, aantal: bestanden.length, bytes, bestanden }, null, 2)}\n`,
);

console.log(`${(bytes / 1024 / 1024).toFixed(1)} MB weggeschreven naar ${doelmap}`);
