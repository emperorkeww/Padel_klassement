// Coach Rudy als verteller van de "Hoe werkt het?"-pagina (#989). Zelfde opzet
// als coachMoments.ts: kale pools hier, één keuzefunctie eromheen, en het
// kiezen/dedupliceren gebeurt met kiesUniek/roastSeed uit roastTone.ts.
//
// Twee banden in plaats van drie. Uitleg is geen roast: wie de app niet snapt
// verdient geen sneer, hij verdient een antwoord. Rudy zet de toon, de alinea
// eronder draagt de informatie. Daarom:
//   • zacht  — roast-schild aan óf intensiteit "mild": een vriendelijke gids.
//   • scherp — "gemeen"/"radioactief": dezelfde uitleg, met de sneer erbij.
// Drie niveaus zou hier vijftien secties × drie pools kosten zonder dat het
// verschil tussen gemeen en radioactief in een uitlegregel nog leesbaar is.

import type { CoachMood, RoastCtx } from "@/features/coach/roastTone";
import { kiesUniek, roastSeed } from "@/features/coach/roastTone";
import type { SectieId } from "@/features/uitleg/secties";

/** Sleutel van een regelpool: elke sectie plus de intro bovenaan de pagina. */
export type UitlegSleutel = SectieId | "intro";

interface Pools {
  zacht: readonly string[];
  scherp: readonly string[];
}

export const UITLEG_REGELS: Record<UitlegSleutel, Pools> = {
  intro: {
    zacht: [
      "Welkom. Ga zitten, pak een bidon: ik loop de hele boel één keer rustig met je door.",
      "Nieuw hier? Geen paniek. Ik heb m'n notitieboekje erbij en leg alles netjes uit.",
      "Fijn dat je er bent. Hieronder staat precies hoe deze club in elkaar zit.",
    ],
    scherp: [
      "Zo. Nieuw hier. Ik leg het één keer uit, dus let op — herhalen doe ik niet.",
      "Je bent binnen. Nu nog leren hoe het werkt, voor je jezelf compleet voor schut zet.",
      "Welkom in de kooi. Lees dit door, dan hoef ik straks minder hard te lachen.",
    ],
  },
  "aan-de-slag": {
    zacht: [
      "Eerst het saaie deel: een foto, een paar vrienden en een groep. Dan mag je de baan op.",
      "Begin bij het begin. Profiel invullen, maatjes zoeken, groep kiezen — klaar.",
      "Drie dingen en je bent onderweg. Ik wacht wel even.",
    ],
    scherp: [
      "Eerst een fatsoenlijke profielfoto. Zonder gezicht is er ook niks te roasten.",
      "Vrienden toevoegen, ja. Als je die hebt. Anders speel je gewoon tegen gasten.",
      "Vul dat profiel in. Een lege kaart met een vraagteken erop is geen goede eerste indruk.",
    ],
  },
  speeldag: {
    zacht: [
      "Een speeldag begint op de agenda, gaat dan naar de groep: spelen, en dan de stand.",
      "Plannen doe je op de agenda, de avond zelf op de groepspagina. Twee plekken, meer niet.",
      "Speeldag, rondes, teams, historie. In die volgorde gaat het vanzelf.",
    ],
    scherp: [
      "Agenda, spelen, stand. Drie stappen, en toch gaat het elke week ergens mis.",
      "Zet die speeldag op tijd open. Anders staan er zaterdag vier man voor een dichte baan.",
      "De tabs lopen van links naar rechts. Net als jouw verdediging, maar dan wél volgens plan.",
    ],
  },
  banen: {
    zacht: [
      "Zonder baan geen match. Hier zie je wat er vrij is en wat het kost.",
      "Kijk even wat er vrij staat, deel de poster, klaar.",
      "Banen eerst. De rest van het feest komt daarna.",
    ],
    scherp: [
      "Zonder baan geen match, en zonder match geen excuus. Boek gewoon.",
      "Kijk hier wat er vrij is voor je weer 'de banen waren vol' roept.",
      "Reserveer op tijd. 'Ik dacht dat jij zou boeken' is geen tactiek.",
    ],
  },
  uitslagen: {
    zacht: [
      "Uitslag invoeren gaat in een paar tikken. Punt voor punt mag ook.",
      "Voer 'm rustig in; klopt er iets niet, dan kun je 'm laten corrigeren.",
      "De wizard leidt je erdoorheen. Je kunt weinig fout doen.",
    ],
    scherp: [
      "Voer je uitslag in. Ook die. Vooral die.",
      "Nee, 'we zijn de score kwijtgeraakt' telt niet. Invullen.",
      "Punt voor punt invoeren mag. Dan zie je precies wanneer het instortte.",
    ],
  },
  rating: {
    zacht: [
      "Je rating is één getal dat zegt hoe sterk je speelt. Meer niet.",
      "Win van iemand die beter is en je stijgt harder. Zo simpel is het.",
      "Rustig aan: de rating beweegt vanzelf de goede kant op als je wint.",
    ],
    scherp: [
      "Eén getal vat je hele padelbestaan samen. Confronterend, hè.",
      "De rating liegt niet. Jij misschien wel, over hoe het ging.",
      "Winnen van een mindere god levert bijna niks op. Pak eens iemand van niveau.",
    ],
  },
  tiers: {
    zacht: [
      "Je divisie volgt je rating. Elke divisie heeft drie treden.",
      "Van onderaan tot bovenaan: een ladder met namen die iets te eerlijk zijn.",
      "Divisies zijn gewoon je rating in een jasje. Met een grappige naam.",
    ],
    scherp: [
      "Van Sletje van de baan tot El Padelissimo. Raad eens waar de meesten blijven hangen.",
      "De namen zijn niet aardig bedoeld. Ze zijn wel accuraat.",
      "Elke divisie heeft drie treden. Je kunt dus drie keer vieren dat je bijna niks bereikt hebt.",
    ],
  },
  troon: {
    zacht: [
      "Bovenaan zit de dictator, onderaan de pias. Zo houden we het spannend.",
      "De troon is voor de nummer één, de schandpaal voor de rest van het verhaal.",
      "Even opletten: dit is het leukste en het pijnlijkste deel van de app tegelijk.",
    ],
    scherp: [
      "Boven de 1600 word je dictator. Daaronder ben je onderdaan. Zo werkt macht.",
      "De troon of de schandpaal. Er is geen comfortabel midden, dat heet middelmaat.",
      "Iemand moet de pias zijn. Statistisch gezien is dat vaker jij dan je lief is.",
    ],
  },
  kaarten: {
    zacht: [
      "Iedereen heeft een spelerskaart. Presteer je goed, dan verandert 'ie.",
      "De kaarten zijn de leukste manier om te zien hoe je ervoor staat.",
      "Speciale edities verdien je met wat je op de baan doet. Hier zie je welke er zijn.",
    ],
    scherp: [
      "Iedereen krijgt een kaart. Niet iedereen krijgt er een om trots op te zijn.",
      "Er zijn gouden edities en er zijn edities van schande. Jij mag kiezen — via je resultaten.",
      "Een mooie kaart koop je niet. Die win je. Vervelend, ik weet het.",
    ],
  },
  badges: {
    zacht: [
      "Badges zijn kleine mijlpalen. Leuk om te verzamelen, niks verplichts.",
      "Speel gewoon door, dan komen ze vanzelf voorbij.",
      "Een badge is een schouderklopje in digitale vorm.",
    ],
    scherp: [
      "Badges zijn schouderklopjes. Sommige daarvan zijn duidelijk sarcastisch bedoeld.",
      "Verzamel ze gerust. Ze compenseren de rating niet, maar het geeft je iets te doen.",
      "Niet elke badge is een compliment. Lees de naam even goed.",
    ],
  },
  toto: {
    zacht: [
      "Voorspellen mag. Goed gokken levert punten op, meer risico levert meer op.",
      "Zet je voorspelling in, kijk hoe het afloopt. Kost je niks.",
      "De toto is voor wie het leuk vindt om vooraf al gelijk te hebben.",
      "En één joker per maand. Eén. Kies je moment.",
    ],
    scherp: [
      "Voorspellen kan iedereen. Goed voorspellen, dát is het probleem.",
      "Lef is een mooie eigenschap. Tot je erop afgerekend wordt in het toto-klassement.",
      "Durf eens tegen de favoriet in te gokken. Of blijf veilig, past ook bij je spel.",
      "Je joker van deze maand: één kaart. Sommigen sparen hem, de rest speelt hem op een dinsdag.",
    ],
  },
  rudy: {
    zacht: [
      "Over mij. Kort, want jij bent hier belangrijker dan ik.",
      "Ik hou de boel in de gaten en zeg er af en toe iets van. Je kunt me zachter zetten.",
      "Ik ben er om het leuk te houden. Vind je me te druk, dan draai je me terug.",
    ],
    scherp: [
      "Even over mij: ik ben je bondscoach-in-ruste en ik zwijg zelden.",
      "Ik roast, jij speelt. Kun je er niet tegen? Dan zet je het schild aan, sukkel.",
      "Ik heb de Rode Duivels naar een debacle geleid. Jouw padelavond overleef ik wel.",
    ],
  },
  feed: {
    zacht: [
      "Het clubblad laat zien wat je vrienden en groepen hebben uitgespookt.",
      "Alles wat er gebeurt komt hier voorbij. Rustig doorscrollen maar.",
      "Zo blijf je op de hoogte zonder in de groepsapp te hoeven duiken.",
    ],
    scherp: [
      "In het clubblad zie je wat iedereen heeft uitgevreten. Inclusief jij, helaas.",
      "Alles komt voorbij. Ook die uitslag waarvan je hoopte dat niemand het zag.",
      "Scrollen is prima. Maar iemand scrollt óók langs jouw resultaten.",
    ],
  },
  seizoen: {
    zacht: [
      "Elk kwartaal maken we de balans op, met een overzicht en een paar prijzen.",
      "Aan het eind van een periode krijg je jouw seizoen in het kort te zien.",
      "De eregalerij bewaart wie er gewonnen heeft. Voor altijd.",
    ],
    scherp: [
      "Elk kwartaal de balans. Voor sommigen is dat een feestje, voor de rest een rapport.",
      "De eregalerij vergeet niets. Je Wrapped trouwens ook niet.",
      "Aan het eind van het kwartaal tel ik alles bij elkaar op. Succes.",
    ],
  },
  meldingen: {
    zacht: [
      "Meldingen aanzetten helpt: dan mis je geen speeldag of uitslag.",
      "Je kunt de app ook op je beginscherm zetten. Werkt net zo fijn als een echte app.",
      "Kies zelf waarvoor je een seintje wilt. Alles uit mag ook.",
    ],
    scherp: [
      "Zet meldingen aan, dan heb je geen excuus meer om die speeldag te missen.",
      "Installeer 'm op je beginscherm. Scheelt je weer een smoes.",
      "Geen meldingen aan én dan klagen dat je niks wist? Nee.",
    ],
  },
  privacy: {
    zacht: [
      "Jij bepaalt wat je deelt en hoeveel je van mij hoort.",
      "Alles wat je liever uitzet, kun je uitzetten. Geen discussie.",
      "Hier staat precies wat er zichtbaar is en voor wie.",
    ],
    scherp: [
      "Wil je me kwijt? Roast-schild aan en ik hou m'n mond. Slap, maar het mag.",
      "Alles wat je liever niet deelt, zet je hier uit. Ook mijn commentaar.",
      "Je kunt me uitzetten. Ik zal het niet persoonlijk opvatten. Veel.",
    ],
  },
};

/**
 * De regel waarmee Coach Rudy een sectie inleidt.
 *
 * `ctx` bepaalt de band (schild aan of "mild" → zacht, anders scherp), `seed`
 * kiest deterministisch binnen de pool, en de gedeelde `gebruikt`-set voorkomt
 * dat één weergave van de pagina twee keer dezelfde regel toont. Geef per
 * paginabezoek een oplopende rotatie mee in de seed, dan cyclen de regels over
 * bezoeken heen (zelfde truc als coachBuiging, #535).
 */
export function coachUitlegRegel(
  sleutel: UitlegSleutel,
  ctx: RoastCtx,
  seed: number,
  gebruikt?: Set<string>,
): string {
  const pools = UITLEG_REGELS[sleutel];
  const zacht = ctx.schild || ctx.intensiteit === "mild";
  return kiesUniek(zacht ? pools.zacht : pools.scherp, seed, gebruikt);
}

/** Seed voor één paginaweergave; `beurt` schuift de keuze bij een volgend
 *  bezoek op zodat je niet twee keer exact dezelfde rondleiding krijgt. */
export function uitlegSeed(sleutel: UitlegSleutel, beurt: number): number {
  return roastSeed("uitleg", sleutel) + beurt;
}

/** Rudy's gezichtsuitdrukking bij de rondleiding: mee-schalend met de toon,
 *  maar nooit venijniger dan de band die de kijker gekozen heeft. */
export function uitlegMood(ctx: RoastCtx): CoachMood {
  if (ctx.schild || ctx.intensiteit === "mild") return "portret";
  return ctx.intensiteit;
}
