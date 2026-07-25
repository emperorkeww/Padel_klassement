// Edge Function: "Genereer dictator-portret" (#554).
//
// Maakt van de profielfoto een over-the-top militair dictator-portret via OpenAI
// gpt-image-1 (image *edit*), in de vaste stijl van de waarnemend-dictator-
// referentie (Kylian Mbappé, groen uniform). Het resultaat komt in de publieke
// avatars-bucket (`{userId}/dictator.png`) en wordt op De Troon (#528/#545)
// getoond i.p.v. de gewone avatar.
//
// Sinds #682 staat het recept in ../_shared/aiPortretHandler.ts en de stijl in
// ../_shared/aiPortret.ts, omdat de pias hetzelfde recept met een andere stijl
// gebruikt (generate-pias-avatar). Gedrag, aanroeppaden, secrets en deploy-vlaggen
// zijn ongewijzigd — zie de kop van aiPortretHandler.ts en de README hiernaast.

import { portretHandler } from "../_shared/aiPortretHandler.ts";
import { STIJLEN } from "../_shared/aiPortret.ts";

Deno.serve((req) => portretHandler(req, STIJLEN.dictator));
