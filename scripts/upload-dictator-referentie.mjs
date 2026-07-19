// Eenmalig de vaste stijlreferentie voor de dictator-portretten (#554) naar de
// publieke avatars-bucket uploaden: avatars/_ref/dictator-stijl.png. De edge
// function generate-dictator-avatar fetcht die URL bij elke generatie (i.p.v. de
// ~2 MB-asset mee te bundelen).
//
// Draai dit één keer per omgeving (lokaal én hosted):
//
//   # lokaal (haal de service-role-key uit `npx supabase status`):
//   SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service_role key> \
//   node scripts/upload-dictator-referentie.mjs
//
//   # hosted:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<hosted service_role key> \
//   node scripts/upload-dictator-referentie.mjs
//
// De bron-PNG is dezelfde die de waarnemend dictator (Mbappé) toont.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Zet SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in de omgeving. Zie de kop van dit bestand.",
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const bronPad = resolve(
  here,
  "../src/features/dictator/components/dictator-portret-groen-uniform.png",
);
const doelPad = "_ref/dictator-stijl.png";

const png = await readFile(bronPad);
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const { error } = await supabase.storage
  .from("avatars")
  .upload(doelPad, png, {
    upsert: true,
    contentType: "image/png",
    cacheControl: "31536000",
  });

if (error) {
  console.error("Upload mislukt:", error.message);
  process.exit(1);
}

const { data } = supabase.storage.from("avatars").getPublicUrl(doelPad);
console.log("Referentie geüpload:", data.publicUrl);
