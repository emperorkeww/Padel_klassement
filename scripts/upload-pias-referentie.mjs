// Eenmalig de vaste stijlreferentie voor de pias-portretten (#682) naar de
// publieke avatars-bucket uploaden: avatars/_ref/pias-stijl.png. De edge function
// generate-pias-avatar fetcht die URL bij elke generatie (i.p.v. de asset mee te
// bundelen).
//
// Anders dan bij de dictator (#554, scripts/upload-dictator-referentie.mjs) zit de
// bron-PNG NIET in de repo: het beeld is enkel een seed voor de bucket, geen
// app-asset, en een paar MB binair in git dienen dan niemand. Geef het pad dus
// mee. De bucket is de bron van waarheid zodra het geüpload is.
//
//   # lokaal (service-role-key uit `npx supabase status`):
//   SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service_role key> \
//   node scripts/upload-pias-referentie.mjs ~/Downloads/pias-stijl.png
//
//   # hosted:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<hosted service_role key> \
//   node scripts/upload-pias-referentie.mjs ~/Downloads/pias-stijl.png
//
// Waar het beeld aan moet voldoen (de prompt in _shared/aiPortret.ts leunt erop):
// een vierkant kop-en-schouders-clownportret, goedmoedig i.p.v. grotesk, met de
// stijl-elementen die de prompt noemt — schmink, rode neus, kleurrijke kraag,
// helder circuslicht, egale achtergrond. Het gezicht op de referentie doet niet
// mee: de function kopieert er uitsluitend kostuum en licht van, en zonder eigen
// profielfoto vraagt de prompt expliciet om een ánder, verzonnen gezicht.

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bronPad = process.argv[2];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Zet SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in de omgeving. Zie de kop van dit bestand.",
  );
  process.exit(1);
}
if (!bronPad) {
  console.error(
    "Geef het pad naar de referentie-PNG mee:\n" +
      "  node scripts/upload-pias-referentie.mjs <pad/naar/pias-stijl.png>",
  );
  process.exit(1);
}

const doelPad = "_ref/pias-stijl.png";

let png;
try {
  png = await readFile(bronPad);
} catch (err) {
  console.error(`Kan ${bronPad} niet lezen:`, err.message);
  process.exit(1);
}

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
