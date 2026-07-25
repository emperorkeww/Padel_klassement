// Edge Function: "Genereer pias-portret" (#682).
//
// Maakt van de profielfoto een hofnar-portret via OpenAI gpt-image-1
// (image *edit*), in de vaste stijl van de pias-referentie in de publieke
// avatars-bucket. Het resultaat komt op `{userId}/pias.png` en wordt op De
// Schandpaal getoond i.p.v. de gewone avatar.
//
// Spiegel van generate-dictator-avatar (#554): hetzelfde recept
// (../_shared/aiPortretHandler.ts), dezelfde twee aanroeppaden, dezelfde secrets
// en dezelfde deploy-vlag (`--no-verify-jwt`). Alleen de stijl verschilt — prompt,
// referentiepad, bestandsnaam en doelkolommen staan in STIJLEN.pias
// (../_shared/aiPortret.ts). Zie de README hiernaast voor de eenmalige setup.

import { portretHandler } from "../_shared/aiPortretHandler.ts";
import { STIJLEN } from "../_shared/aiPortret.ts";

Deno.serve((req) => portretHandler(req, STIJLEN.pias));
