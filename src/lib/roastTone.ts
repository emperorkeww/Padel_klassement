// Roast-fundament (#183): centrale toon-regie voor de hele app. Elk roast-
// oppervlak (pias van de week/maand, profiel, …) levert een kále, feitelijke
// observatie ("feit") aan en laat kleurRoast die kleuren met de stem van de
// commentator, gedoseerd op de roast-intensiteit van de groep. Zet een speler
// zijn roast-schild aan, dan komt het feit ongekleurd terug — plagen, geen
// kwetsen, en wie niet mee wil hoeft niet. Puur en getest in roastTone.test.ts.

import type { Group, Profile, RoastIntensiteit } from "./types";

export type { RoastIntensiteit };

/** De vaste commentator-stem die de roast tekent (naam aanpasbaar). */
export const COMMENTATOR = { naam: "Coach Rudy", emoji: "🎙️" } as const;

/**
 * De gezichtsuitdrukking/reactie die Coach Rudy's illustratie toont, gekoppeld
 * aan de aard van zijn commentaar. `portret` is de neutrale signatuur (default
 * én fallback), `trots` is juichend bij een zege/promotie, en de drie
 * intensiteiten tonen een burn op dat niveau. Zie CoachAvatar voor de
 * bestandsconventie (rudi-<stemming>[-<n>].png).
 */
export type CoachMood = "portret" | "trots" | RoastIntensiteit;

export interface RoastCtx {
  /** Toon van de groep; bepaalt hoe hard de sneer is. */
  intensiteit: RoastIntensiteit;
  /** Heeft het doelwit zijn roast-schild aan? Dan geen sneer. */
  schild: boolean;
}

/** Coach Rudy's commentaar achter het feit aan, per niveau. Plagen, geen
 *  kwetsen: altijd over padel/ego, nooit persoonlijk. */
export const SNEER: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Iedereen heeft z'n day niet. Jij vaak.",
    "Volgende keer beter, hè. Of slechter, als dat fysiek nog mogelijk is.",
    "Kop op, kampioen. Er is altijd nog jeu de boules.",
    "'t Is maar padel. Al leek dit vandaag meer op ballet.",
    "Op papier was dit waarschijnlijk een tactisch meesterwerk.",
    "Goed geprobeerd! De inzet was er, de techniek liet helaas verstek gaan.",
    "Je hield de spanning er in ieder geval goed in voor de toeschouwers.",
    "Sportiviteit is ook een prijs waard. Gelukkig voor jou.",
    "Iedereen heeft een offdag.",
    "Morgen is er weer een kans.",
    "Daar leer je van, zeggen ze.",
    "Niet getreurd, blijven oefenen.",
    "Het zat gewoon even tegen.",
    "Volgende keer pak je ze wel.",
    "Gebeurt de beste weleens.",
    "Schud het van je af.",
    "Had je je gripje toevallig in de boter gelegd? 🧈",
    "Ach ja, de bal is rond. En in jouw geval vaak out.",
    "Mooie warming-up. Wanneer begint de echte wedstrijd?",
    "Het glas was in ieder geval van prima kwaliteit vandaag.",
    "Je hield je tactische meesterplan wel heel erg geheim.",
    "Zelfs mijn kletsnatte pak door de watersproeier zat vandaag strakker in elkaar dan jouw verdediging.",
    "Was dit een tactisch meesterwerk of leek het er toevallig op?",
    "Met zo'n voorbereiding had je bij Lille in 2011 op de bank gezeten naast de ballenjongens.",
    "Zelfs de Romeinse pers was milder voor mij dan ik vandaag voor dit spel ben.",
    "Je slagen missen vandaag elke vorm van Franse elegantie.",
    "Ik ben driftig in m'n notitieboekje aan het krabbelen hoe dit beter moet.",
    "Deze match vraagt om een wissel in de 89e minuut.",
    "Zat je tactiek soms verstopt onder je pet?",
    "Een tactiek zo geheimzinnig, dat zelfs je medespeler er niks van begreep.",
    "Heb je tijdens het spel ook een notitieboekje nodig om te onthouden waar de bal heen moet?",
    "Mooi geprobeerd. Je partner verdient in ieder geval een lintje voor zijn engelengeduld.",
    "Een tactiek zo geheimzinnig dat je tegenstander oprecht dacht dat je niet meedeed.",
    "De wind was inderdaad erg aanwezig vandaag. De zwaartekracht helaas ook.",
    "Zelfs op de bank bij Lille in 2011 zat er meer dynamiek en levenslust in de selectie dan in jouw voetenwerk.",
    "Je slagen hebben de Franse elegantie en het verfijnde gevoel van een omvallende lantaarnpaal.",
    "Ik heb bidons sneller zien leeglopen dan jouw energieniveau in de tweede set.",
    "Je tactiek was vandaag als een persconferentie zonder geluid: niemand snapte er iets van.",
    "De tegenstander hoefde niet eens te rennen, jouw ballen vlogen keurig hun kant op.",
    "Je hebt de kooi in ieder geval heel gelaten. Dat is ook een vorm van vooruitgang.",
    "Zelfs op de bank bij Lille was de sfeer sportiever dan jouw blik na die gemiste smash.",
    "Je slagen waren vandaag net zo legitiem als de opschorting van Baloguns rode kaart. Iedereen zag het, niemand greep in.",
    "Een uiterst twijfelachtig punt. Gianni Infantino zou dit waarschijnlijk bestempelen als 'volledig onafhankelijk beslist'.",
    "Jouw spel had vandaag veel weg van een Trump-rally: veel lawaai, weinig inhoud en achteraf claimen dat je historisch gewonnen hebt.",
    "De tegenstander kneep een oogje toe. Heb je stiekem met Infantino gebeld voor een voorwaardelijke opschorting van de regels?",
  ],
  gemeen: [
    "Pijnlijk om te zien. Zelfs het publiek keek collectief weg.",
    "Was dit padel of een wanhopige poging tot moderne dance?",
    "Ik wist niet dat je de glazen wand zo intensief kon testen.",
    "Je tegenstanders danken je hartelijk voor de gratis punten.",
    "Mijn oma reageert opmerkelijk sneller op een diepe lob.",
    "De cijfers liggen niet, en ze vertellen geen sprookje.",
    "Zwak. Gewoon heel zwak. Heb je je racket wel eens andersom vastgehouden?",
    "Had je je zonnebril nog op? Of speelde je gewoon met je ogen dicht?",
    "Trainen, gij. Dringend.",
    "Zelfs je stats schamen zich.",
    "Dat was geen hoogstandje.",
    "Ik zag het al van ver aankomen.",
    "Trainen is geen straf, hè.",
    "Je maat verdient echt beter.",
    "Even diep ademhalen en nadenken.",
    "Dat blijft nog even nagalmen.",
    "Niet je beste werk. Understatement.",
    "Daar praten we volgende week nog over.",
    "Was dat een lob of een bewuste uitnodiging om te smashen?",
    "Ik heb lantaarnpalen nog actiever zien meebewegen aan het net.",
    "Die bandeja had meer weg van een slappe pannenkoek.",
    "Als je het net niet raakt, telt het ook gewoon als een punt, wist je dat?",
    "Gelukkig is de derde helft traditioneel jouw sterkste set.",
    "Je tactiek had vandaag wel erg veel weg van mijn kledingkeuze tegen Egypte: een totale moderamp.",
    "Net zo kansloos als België tegen Spanje in de kwartfinale van het WK. Pijnlijk.",
    "Dit tactisch debacle deed me erg denken aan mijn korte tijd bij Napoli. Alsnog sneller voorbij dan je service.",
    "Ik pak m'n denkbeeldige viool er alvast bij om deze prestatie te bezingen.",
    "Was je vandaag geïnspireerd door Kvaratskhelia? Die zat namelijk ook 90 minuten op de bank.",
    "Zelfs met Cristiano Ronaldo in de spits had je deze match niet meer gered.",
    "Nog vreemder dan mijn wissels tijdens het WK. En geloof me, die waren heel vreemd.",
    "Ik heb drie pagina's volgeschreven over deze blunder. Allemaal met uitroeptekens.",
    "Dit gedrag langs de lijn is bijna net zo bizar als mijn persconferenties bij de Rode Duivels.",
    "Als je zo blijft spelen, ben je sneller uit de gratie dan een bondscoach na de groepsfase van het WK.",
    "Met zo'n rare veldbezetting leek het wel alsof je met elf man aan het spelen was.",
    "Ik heb op het WK veel tactische blunders gezien, maar deze service sloeg echt alles.",
    "Jouw spel leest als een handleiding voor hoe je absoluut níét moet verdedigen.",
    "Zelfs een slapende supporter op vak G had vandaag meer balgevoel getoond.",
    "Heb je wel eens overwogen om supporterslid te worden in plaats van speler? Daar ben je waarschijnlijk beter in.",
    "Dat was geen service, dat was een cadeautje met een strik erom voor de tegenstander.",
    "Ik heb op het WK veel bizarre tactische keuzes gezien, maar jouw positionering staat nu bovenaan mijn lijst van onverklaarbare fenomenen.",
    "Het was net alsof je probeerde padel te spelen met een kapot badmintonracket.",
    "Tactisch een totale moderamp. Zelfs mijn felgekleurde trainingspakken uit de jaren 90 zagen er strakker uit.",
    "De bookmakers huilen van het lachen en de tegenstander viert feest. Gratis punten voor iedereen.",
    "Je bandeja deed me sterk denken aan een slappe Belgische wafel die net iets te lang in de stromende regen heeft gelegen.",
    "Zelfs met vier opeenvolgende tactische wissels in de absolute slotminuten was hier geen redden meer aan.",
    "Was dit een wedstrijd of een demonstratie van hoe je je partner het beste kunt negeren?",
    "Zelfs mijn meest onbegrijpelijke opstellingen op het WK hadden meer structuur dan jouw veldpositie.",
    "Als je de ballen nog één keer zo hoog opslaat, moeten we de luchtverkeersleiding gaan waarschuwen.",
    "Je speelde alsof je racket een pan was waar de pannenkoeken steeds uitvielen.",
    "Zelfs de meest kritische Belgische journalist zou medelijden krijgen met jouw backhand.",
    "Zelfs als Donald Trump persoonlijk naar de FIFA belt, valt deze wanprestatie met geen enkele voorwaardelijke opschorting recht te praten.",
    "Jouw backhand is net zo corrupt en krom als de beslissingen van de FIFA-disciplinaire commissie tijdens het WK.",
    "Je claimt de overwinning, maar net als bij Trump is de werkelijkheid toch echt dat je dik verloren hebt. Stop the steal!",
    "Was die bal werkelijk in? Dit riekt naar een groter omkoopschandaal dan de toewijzing van het WK aan Qatar.",
  ],
  radioactief: [
    "Ik keek liever weg, voor jou.",
    "Heb je al eens aan curling gedacht?",
    "Ronduit gênant. Zelfs de bal leek te weigeren om met je mee te werken.",
    "Overweeg serieus een andere hobby. Schaken of postzegels verzamelen?",
    "Als falen een olympische discipline was, stond je nu bovenaan het podium.",
    "Ik heb tennisballen tégen een blinde muur beter zien terugkomen.",
    "Dit was geen wedstrijd, dit was een regelrechte misdaad tegen de padelsport.",
    "Zullen we je lidmaatschap stilletjes omruilen voor een abonnement op Netflix?",
    "Je bewoog met de gratie van een natte krant in een zware herfststorm.",
    "Zelfs de scheidsrechter had medelijden — en we hebben niet eens een scheidsrechter.",
    "Dit zet ik in de groepschat. Voor de eeuwigheid.",
    "Mijn oma slaat harder. En die padelt niet eens.",
    "Was dat opzet? Zeg alsjeblieft ja.",
    "Een standbeeld had meer ballen geraakt.",
    "Ik heb geen woorden. Nou ja, deze dan.",
    "Je tegenstander verveelde zich kapot.",
    "Historisch slecht. Dat is óók een prestatie.",
    "Ik zou m'n racket inleveren. Definitief.",
    "Een tennisracket heeft gaten, maar jouw verdediging had er nog veel meer.",
    "Zelfs een blinde meeuw had die bal nog binnen de kooi gehouden.",
    "Was je racket vandaag stiekem van spons gemaakt?",
    "Sommige spelers hebben talent, anderen hebben gewoon een heel mooi padelshirt.",
    "Ik zou je inschrijving voor het volgende toernooi maar stilletjes annuleren.",
    "Ik stond tenminste nog in een chic pak met een sportpet langs de lijn, maar jouw spel was pas écht een tactische ramp.",
    "Zelfs de Rode Duivels hadden tijdens het WK minder moeite om de weg kwijt te raken dan jij.",
    "Na deze vertoning zou zelfs de Belgische voetbalbond me direct ontslaan als ik jou nog eens opstelde.",
    "Jouw spel had vandaag de tactische diepgang van een natte spons op een snikhete WK-middag.",
    "Ik ben sneller ontslagen bij Al-Nassr dan dat jij je racket naar achteren haalt voor een forehand.",
    "Zelfs Aurelio De Laurentiis zou weigeren om te betalen voor een ticket om jou te zien spelen.",
    "Dit was zo slecht dat we de FIFA moeten vragen om padel te verbieden in de Benelux.",
    "Ga je nu huilen? Zal ik een viool voor je pakken?",
    "Je spel is zo onnavolgbaar dat ik spontaan een viervoudige wissel in de 89e minuut wil doorvoeren, gewoon om het niet meer te hoeven zien.",
    "Ik schrijf zoveel tactische blunders op dat m'n pen leeg is. Zelfs het WK-notitieboekje was leger.",
    "Zelfs de Belgische pers had na de uitschakeling op het WK minder kritiek op mij dan ik op jouw wanprestatie.",
    "Ik heb veel kritiek gekregen op mijn tactiek met de Duivels, maar vergeleken met jouw positiespel ben ik een tactisch genie.",
    "Zelfs een wissel in de 94e minuut had dit zinkende schip niet meer kunnen redden.",
    "Dit was zo pijnlijk dat ik ter plekke mijn pet over mijn gezicht heb getrokken.",
    "Als we voor elke fout van jou een euro kregen, konden we de hele Belgische voetbalbond uit de schulden kopen.",
    "Je speelde alsof je benen in beton gegoten stonden en je racket gemaakt was van slap karton.",
    "Met dit niveau van tactisch falen stuur ik je direct terug naar de jeugdopleiding. En zelfs daar zit je op de bank.",
    "Zelfs een overduidelijke scheidsrechterlijke blunder kan deze verschrikkelijke vertoning niet rechtpraten.",
    "Dit was zo dramatisch dat mijn notitieboekje uit pure schaamte spontaan in brand is gevlogen.",
    "Met zo'n prestatie zou je zelfs bij een gedegradeerd Schalke 04 nog op de tribune worden gezet.",
    "Ga alsjeblieft een andere sport zoeken. Ik hoorde dat onderwaterdammen in teamverband erg in trek is.",
    "Een werkelijk historische wanprestatie. Zelfs de glazen wanden begonnen spontaan te barsten uit pure plaatsvervangende schaamte.",
    "Zelfs Aurelio De Laurentiis zou weigeren om de huur van je kluisje te betalen na deze vreselijke vertoning.",
    "Ik ben sneller ontslagen in Saudi-Arabië dan dat jij je voeten van de grond tilt voor een smash.",
    "Dit was zo ontiegelijk pijnlijk dat ik ter plekke mijn coach-pet diep over mijn ogen heb getrokken om het niet te hoeven aanzien.",
    "Ik ben sneller weggestuurd bij Napoli dan dat jij omschakelt van verdediging naar aanval.",
    "Dit was geen padel, dit was een regelrechte aanval op de goede smaak en de sportiviteit.",
    "Als de Belgische bondscoach mij na deze pot had opgesteld, had ik ter plekke mijn ontslag ingediend.",
    "Zelfs met Cristiano Ronaldo en Lionel Messi in je team had je deze afgang niet kunnen camoufleren.",
    "Een legendarische wanprestatie. Ik heb de bladzijde uit mijn notitieboekje gescheurd om hem ritueel te verbranden.",
    "Dit spel was zo corrupt en vals dat zelfs Sepp Blatter en Gianni Infantino er rode koppen van zouden krijgen.",
    "Als dit een WK-match was, had Trump nu al met Infantino aan de lijn gehangen om te eisen dat jouw rode kaart voorwaardelijk wordt opgeschort.",
    "Een absolute schande voor de sport. Zelfs de meest corrupte FIFA-officials zouden weigeren om steekpenningen aan te nemen om dit spel goed te praten.",
    "Je claimt dat je geweldig speelde, maar dat is 'fake news' van het allerhoogste Trump-niveau. Zelfs Bosnië werd minder opgelicht dan jouw partner vandaag.",
  ],
} as const;

/** Deterministische, positieve start-index in een pool op basis van de seed. */
function seedIndex(len: number, seed: number): number {
  return ((seed % len) + len) % len;
}

/**
 * Kiest deterministisch uit de pool op basis van de seed, maar slaat lijnen in
 * `gebruikt` over (probeert opeenvolgende indices) zodat één weergave geen
 * dubbele quip toont; de gekozen lijn wordt aan `gebruikt` toegevoegd. Valt
 * terug op de kále seed-keuze als alles al gebruikt is. Zonder `gebruikt`
 * gedraagt hij zich exact als een gewone seed-keuze (voor single-item-
 * oppervlakken zoals profiel/PiasCard, waar dedup niet nodig is).
 */
export function kiesUniek<T>(
  pool: readonly T[],
  seed: number,
  gebruikt?: Set<T>,
): T {
  const len = pool.length;
  const start = seedIndex(len, seed);
  if (gebruikt) {
    for (let k = 0; k < len; k++) {
      const kandidaat = pool[(start + k) % len];
      if (!gebruikt.has(kandidaat)) {
        gebruikt.add(kandidaat);
        return kandidaat;
      }
    }
  }
  return pool[start];
}

/**
 * Alleen de sneer-staart van de commentator, of "" bij schild. Handig voor
 * JSX-oppervlakken die de feitelijke zin (met `<strong>` e.d.) willen behouden
 * en er enkel Coach Rudy's jab achteraan plakken.
 */
export function sneerSuffix(ctx: RoastCtx, seed: number): string {
  if (ctx.schild) return "";
  return ` — ${COMMENTATOR.emoji} ${kiesUniek(SNEER[ctx.intensiteit], seed)}`;
}

/**
 * De kále sneer-tekst (zonder streepje/emoji), of null wanneer het doelwit
 * zijn roast-schild aan heeft. Voor oppervlakken die Coach Rudy als aparte,
 * geattribueerde commentator tonen (bv. de feed-speech-bubble) i.p.v. een
 * inline staart. Geef optioneel een `gebruikt`-set mee om binnen één weergave
 * (bv. de feed-lijst) herhaling van dezelfde sneer te vermijden.
 */
export function coachSneer(
  ctx: RoastCtx,
  seed: number,
  gebruikt?: Set<string>,
): string | null {
  if (ctx.schild) return null;
  return kiesUniek(SNEER[ctx.intensiteit], seed, gebruikt);
}

/**
 * Kleurt een feitelijke observatie met de commentator-toon op het gekozen
 * niveau. Schild aan → het kále feit (neutrale variant, geen sneer). `seed`
 * (bv. hash van playerId + periode) kiest deterministisch de sneer, zodat de
 * hele groep dezelfde burn ziet.
 */
export function kleurRoast(feit: string, ctx: RoastCtx, seed: number): string {
  return feit + sneerSuffix(ctx, seed);
}

/** Leidt de roast-context af uit de groep + het doelwit-profiel. Ontbrekende
 *  velden vallen terug op de DB-defaults (gemeen / schild neer). */
export function roastCtx(
  group: Pick<Group, "roast_intensiteit"> | null | undefined,
  target: Pick<Profile, "roast_schild"> | null | undefined,
): RoastCtx {
  return {
    intensiteit: group?.roast_intensiteit ?? "gemeen",
    schild: target?.roast_schild ?? false,
  };
}

/** Kleine stabiele hash (djb2), voor een deterministische seed uit bv.
 *  playerId + periode. */
export function roastSeed(...delen: string[]): number {
  let h = 5381;
  const s = delen.join("|");
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return h;
}
