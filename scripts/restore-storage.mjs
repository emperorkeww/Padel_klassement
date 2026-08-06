// Zet een storage-backup terug in een bucket (#1059) — het spiegelbeeld van
// backup-storage.mjs. Bewust een eigen script en niet `supabase storage cp -r`:
// dat commando zit achter --experimental én heeft verrassende padsemantiek
// (bij een bucket-root plakt hij de naam van de bronmap er nog eens voor, dus
// `cp -r ./avatars ss:///avatars` levert /avatars/avatars/...).
//
// Gebruik — de service-role-key haal je op dat moment uit het dashboard
// (Project Settings > API); die staat bewust niet als repo-secret:
//
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role key> \
//   node scripts/restore-storage.mjs <map-met-de-backup>
//
// <map-met-de-backup> is de uitgepakte `storage/`-map: die bevat `avatars/`
// plus `avatars-manifest.json`. Het script controleert achteraf tegen dat
// manifest dat elk bestand er weer is, met dezelfde grootte.
//
// De bucket moet al bestaan. Bij een herstel op een leeg project maak je hem
// met de migratie 20260701150000_avatars_storage.sql — de bucket en zijn
// policies zijn code, geen data, en zitten dus niet in de backup.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.BACKUP_BUCKET ?? "avatars";
const bronmap = process.argv[2];

if (!SUPABASE_URL || !SERVICE_KEY || !bronmap) {
  console.error(
    "Gebruik: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/restore-storage.mjs <map>",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const bucketmap = join(bronmap, BUCKET);

/** Alle bestandspaden onder `map`, recursief, relatief aan de bucket-root. */
async function bestanden(map) {
  const gevonden = [];
  for (const entry of await readdir(map, { withFileTypes: true })) {
    const pad = join(map, entry.name);
    if (entry.isDirectory()) gevonden.push(...(await bestanden(pad)));
    else gevonden.push(relative(bucketmap, pad));
  }
  return gevonden;
}

const paden = await bestanden(bucketmap);
console.log(`${paden.length} bestand(en) terugzetten in bucket "${BUCKET}"`);

for (const pad of paden) {
  const inhoud = await readFile(join(bucketmap, pad));
  // upsert: een halverwege afgebroken restore mag je gewoon opnieuw draaien.
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(pad, inhoud, { upsert: true });
  if (error) {
    console.error(`Upload van "${pad}" mislukte: ${error.message}`);
    process.exit(1);
  }
}

// Tegen het manifest aan houden: een restore die stil de helft overslaat ziet
// er net zo groen uit als een geslaagde.
const manifestPad = join(bronmap, `${BUCKET}-manifest.json`);
const manifest = JSON.parse(await readFile(manifestPad, "utf8"));
const opSchijf = new Map(
  await Promise.all(
    paden.map(async (p) => [p, (await stat(join(bucketmap, p))).size]),
  ),
);

let fout = 0;
for (const { pad, grootte } of manifest.bestanden) {
  const feitelijk = opSchijf.get(pad);
  if (feitelijk === undefined) {
    console.error(`Ontbreekt in de backup: ${pad}`);
    fout++;
  } else if (grootte !== null && feitelijk !== grootte) {
    console.error(`Andere grootte: ${pad} (${feitelijk} i.p.v. ${grootte})`);
    fout++;
  }
}

if (fout > 0) {
  console.error(`${fout} afwijking(en) t.o.v. het manifest.`);
  process.exit(1);
}

console.log(`Klaar: ${manifest.bestanden.length} bestand(en) komen overeen met het manifest.`);
