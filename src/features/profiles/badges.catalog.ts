// De volledige badge-catalogus: één (bewust lange) lijst badge-definities in
// vaste volgorde. Puur data + behaald-checks op de vooraf berekende context.
import type { Badge } from "./badges";
import { ANGSTGEGNER_DREMPEL, BACK_TO_BACK_MINUTEN, BAGELBAKKER_DOEL, COMEBACK_DREMPEL, DEJAVU_DOEL, DIEPZEE_DREMPEL, DUBBELE_CIJFERS_DREMPEL, FOTOFINISH_DOEL, IRONMAN_DOEL, JOJO_DOEL, KALENDER_DOEL, KLOKVAST_DOEL, MARATHON_DOEL, MIJLPALEN, MONSTERZEGE_DREMPEL, NACHTWACHT_DOEL, PECHVOGEL_DREMPEL, PERFECTE_WEKEN, PERFECTIONIST_DOEL, PUNTENMACHINE_DOEL, RATINGTIERS, REEKSEN, REUZENDODER_DREMPEL, RIVAAL_DOEL, ROESTVRIJ_DAGEN, SNIPER_DOEL, SOCIALE_VLINDER_DOEL, TROUWE_ZIEL_DOEL, TWEELING_DOEL, VERLOREN_ZOON_DAGEN, WEEKRITME_DOEL, WINSTEN, YINYANG_DOEL, ZWARTE_REEKS_DREMPEL, ZWITSERLAND_DOEL } from "./badges.constants";
import type { MatchFeiten } from "./badges.facts";
import { angstgegnerVerslagen, hadComeback, hadRevanche, isGestruikeld, isReuzendoder } from "./badges.streaks";
import { perfecteWeken } from "@/features/dashboard/missions";
import type { Match, PlayerRating, Team } from "@/types";

export interface BadgeContext {
  matches: Match[];
  teams: Record<string, Team>;
  playerId: string;
  ratings?: Record<string, PlayerRating>;
  gespeeld: number;
  gewonnen: number;
  verloren: number;
  reeks: number;
  pech: number;
  eigenRating: number | null;
  feiten: MatchFeiten;
  dejaVu: number;
  jojo: number;
  rust: { maxKloofDagen: number; winstNaRust: boolean };
  tweeling: number;
}

export function buildBadges(ctx: BadgeContext): Badge[] {
  const {
    matches, teams, playerId, ratings,
    gespeeld, gewonnen, verloren, reeks, pech, eigenRating,
    feiten, dejaVu, jojo, rust, tweeling,
  } = ctx;

  const badges: Badge[] = [
    {
      id: "eerste-overwinning",
      naam: "Eerste overwinning",
      emoji: "🎉",
      omschrijving: "Win je allereerste match.",
      behaald: gewonnen >= 1,
    },
  ];

  for (const { doel, naam, emoji } of MIJLPALEN) {
    badges.push({
      id: `matches-${doel}`,
      naam,
      emoji,
      omschrijving: `Speel ${doel} matches.`,
      behaald: gespeeld >= doel,
      voortgang: { nu: gespeeld, doel },
    });
  }

  for (const { doel, naam, emoji } of REEKSEN) {
    badges.push({
      id: `reeks-${doel}`,
      naam,
      emoji,
      omschrijving: `Win ${doel} matches op rij.`,
      behaald: reeks >= doel,
      voortgang: { nu: reeks, doel },
    });
  }

  for (const { doel, naam, emoji } of WINSTEN) {
    badges.push({
      id: `winsten-${doel}`,
      naam,
      emoji,
      omschrijving: `Win ${doel} matches in totaal.`,
      behaald: gewonnen >= doel,
      voortgang: { nu: gewonnen, doel },
    });
  }

  badges.push({
    id: "reuzendoder",
    naam: "Reuzendoder",
    emoji: "🗡️",
    omschrijving: `Klop een team met een gemiddelde rating die minstens ${REUZENDODER_DREMPEL} punten hoger ligt.`,
    behaald: ratings ? isReuzendoder(matches, teams, playerId, ratings) : false,
  });

  // Extra badges — een mix van serieuze prestaties en ludieke mijlpalen.
  // Bewust ná de reuzendoder: de deel-kaart toont de laatst behaalde badge, dus
  // de "zwaardere" prestaties staan achteraan zodat die bovenaan komen.
  badges.push(
    {
      id: "diplomaat",
      naam: "Diplomaat",
      emoji: "🤝",
      omschrijving: "Speel een match gelijk — niemand die durft te winnen.",
      behaald: feiten.gelijk >= 1,
    },
    {
      id: "weekendstrijder",
      naam: "Weekendstrijder",
      emoji: "🏖️",
      omschrijving: "Speel een match in het weekend.",
      behaald: feiten.weekend,
    },
    {
      id: "vroege-vogel",
      naam: "Vroege vogel",
      emoji: "🐓",
      omschrijving: "Speel een match vóór 8 uur 's ochtends.",
      behaald: feiten.vroeg,
    },
    {
      id: "nachtbraker",
      naam: "Nachtbraker",
      emoji: "🦉",
      omschrijving: "Speel een match ná 22 uur 's avonds.",
      behaald: feiten.nacht,
    },
    {
      id: "marathonspeler",
      naam: "Marathonspeler",
      emoji: "🥵",
      omschrijving: `Speel ${MARATHON_DOEL} matches op één dag.`,
      behaald: feiten.maxPerDag >= MARATHON_DOEL,
      voortgang: { nu: feiten.maxPerDag, doel: MARATHON_DOEL },
    },
    {
      id: "pechvogel",
      naam: "Pechvogel",
      emoji: "☔",
      omschrijving: `Verlies ${PECHVOGEL_DREMPEL} matches op rij — ook dat is een prestatie.`,
      behaald: pech >= PECHVOGEL_DREMPEL,
      voortgang: { nu: pech, doel: PECHVOGEL_DREMPEL },
    },
    {
      id: "nagelbijter",
      naam: "Nagelbijter",
      emoji: "😬",
      omschrijving: "Win een match met exact één punt verschil.",
      behaald: feiten.nagelbijter,
    },
    {
      id: "broodje-bal",
      naam: "6-0 Droog",
      emoji: "🥯",
      omschrijving: "Win een match zonder de tegenstander één game te gunnen.",
      behaald: feiten.broodje,
    },
    {
      id: "sociale-vlinder",
      naam: "Sociale vlinder",
      emoji: "🦋",
      omschrijving: `Speel met ${SOCIALE_VLINDER_DOEL} verschillende partners.`,
      behaald: feiten.partners >= SOCIALE_VLINDER_DOEL,
      voortgang: { nu: feiten.partners, doel: SOCIALE_VLINDER_DOEL },
    },
    {
      id: "trouwe-ziel",
      naam: "Trouwe ziel",
      emoji: "💞",
      omschrijving: `Speel ${TROUWE_ZIEL_DOEL} matches met dezelfde partner.`,
      behaald: feiten.maxZelfdePartner >= TROUWE_ZIEL_DOEL,
      voortgang: { nu: feiten.maxZelfdePartner, doel: TROUWE_ZIEL_DOEL },
    },
    {
      id: "comebackkoning",
      naam: "Comebackkoning",
      emoji: "👑",
      omschrijving: `Win een match meteen na ${COMEBACK_DREMPEL} verliezen op rij.`,
      behaald: hadComeback(matches, teams, playerId),
    },
    {
      id: "monsterzege",
      naam: "Monsterzege",
      emoji: "🦖",
      omschrijving: `Win een match met minstens ${MONSTERZEGE_DREMPEL} punten verschil.`,
      behaald: feiten.monsterzege,
    },
  );

  // Nog een lading badges — ludiek, zeldzaam en een paar extreme. Allemaal puur
  // afgeleid uit de al geladen matches (uitslag, tijdstip, score, partner,
  // tegenstander, rating). Volgorde-afspraak: negatieve/pech-badges eerst en de
  // indrukwekkendste achteraan, want de deel-kaart toont de laatst behaalde.

  // 1) Pech & tegenslag (bewust vooraan zodat ze nooit het "hoogtepunt" zijn).
  badges.push(
    {
      id: "hartverscheurend",
      naam: "Hartverscheurend",
      emoji: "💔",
      omschrijving: "Verlies een match met exact één punt verschil.",
      behaald: feiten.verliesMet1,
    },
    {
      id: "afgedroogd",
      naam: "Afgedroogd",
      emoji: "🧽",
      omschrijving: "Verlies een match zonder zelf één game te pakken — au.",
      behaald: feiten.verliesZonderScore,
    },
    {
      id: "rampdag",
      naam: "Rampdag",
      emoji: "🌪️",
      omschrijving: `Verlies álle matches op een dag met minstens ${MARATHON_DOEL} partijen.`,
      behaald: feiten.rampdag,
    },
    {
      id: "zwarte-reeks",
      naam: "Zwarte reeks",
      emoji: "🕳️",
      omschrijving: `Verlies ${ZWARTE_REEKS_DREMPEL} matches op rij — dieper kan bijna niet.`,
      behaald: pech >= ZWARTE_REEKS_DREMPEL,
      voortgang: { nu: pech, doel: ZWARTE_REEKS_DREMPEL },
    },
  );

  // 2) Tijd, seizoen & feestdagen (ludiek).
  badges.push(
    {
      id: "debutant",
      naam: "Debutant",
      emoji: "🐣",
      omschrijving: "Speel je allereerste match — welkom op de baan.",
      behaald: gespeeld >= 1,
    },
    {
      id: "maandagmatch",
      naam: "Maandagmatch",
      emoji: "☕",
      omschrijving: "Trap de week af met een match op maandag.",
      behaald: feiten.maandag,
    },
    {
      id: "vrijdagborrel",
      naam: "Vrijdagborrel",
      emoji: "🍻",
      omschrijving: "Speel een match op vrijdagavond (na 18 uur).",
      behaald: feiten.vrijdagavond,
    },
    {
      id: "zomerkoning",
      naam: "Zomerkoning",
      emoji: "☀️",
      omschrijving: "Speel een match in de zomer (juni t/m augustus).",
      behaald: feiten.zomer,
    },
    {
      id: "nachtmens",
      naam: "Nachtmens",
      emoji: "🌙",
      omschrijving: "Sla een bal tussen middernacht en 5 uur 's nachts.",
      behaald: feiten.naMiddernacht,
    },
    {
      id: "nachtwacht",
      naam: "Nachtwacht",
      emoji: "🌃",
      omschrijving: `Speel ${NACHTWACHT_DOEL} matches ná 22 uur.`,
      behaald: feiten.nachtAantal >= NACHTWACHT_DOEL,
      voortgang: { nu: feiten.nachtAantal, doel: NACHTWACHT_DOEL },
    },
    {
      id: "nieuwjaarsduik",
      naam: "Nieuwjaarsduik",
      emoji: "🎆",
      omschrijving: "Begin het jaar sportief: speel op nieuwjaarsdag.",
      behaald: feiten.nieuwjaar,
    },
    {
      id: "kerstengel",
      naam: "Kerstengel",
      emoji: "🎄",
      omschrijving: "Ruil de kalkoen voor het racket op eerste kerstdag.",
      behaald: feiten.kerst,
    },
  );

  // 3) Zeldzame & knappe prestaties (oplopend naar de zwaarste; die staan
  //    achteraan zodat ze bovenaan de deel-kaart komen).
  badges.push(
    {
      id: "allrounder",
      naam: "Allrounder",
      emoji: "🎭",
      omschrijving: "Boek minstens één winst, één verlies én één gelijkspel.",
      behaald: gewonnen >= 1 && verloren >= 1 && feiten.gelijk >= 1,
    },
    {
      id: "bagelbakker",
      naam: "Drooglegger",
      emoji: "🥖",
      omschrijving: `Win ${BAGELBAKKER_DOEL} keer een match met 6-0.`,
      behaald: feiten.broodjeAantal >= BAGELBAKKER_DOEL,
      voortgang: { nu: feiten.broodjeAantal, doel: BAGELBAKKER_DOEL },
    },
    {
      id: "vaste-rivaal",
      naam: "Vaste rivaal",
      emoji: "🎯",
      omschrijving: `Speel ${RIVAAL_DOEL} keer tegen hetzelfde team.`,
      behaald: feiten.maxTegenstander >= RIVAAL_DOEL,
      voortgang: { nu: feiten.maxTegenstander, doel: RIVAAL_DOEL },
    },
    {
      id: "revanche",
      naam: "Revanche",
      emoji: "⚔️",
      omschrijving: "Versla een team waarvan je eerder verloor — koud opgediend.",
      behaald: hadRevanche(matches, teams, playerId),
    },
    {
      id: "ironman",
      naam: "Ironman",
      emoji: "🏋️",
      omschrijving: `Speel ${IRONMAN_DOEL} matches op één dag — ijzeren conditie.`,
      behaald: feiten.maxPerDag >= IRONMAN_DOEL,
      voortgang: { nu: feiten.maxPerDag, doel: IRONMAN_DOEL },
    },
    {
      id: "perfecte-dag",
      naam: "Perfecte dag",
      emoji: "🌟",
      omschrijving: `Win álle matches op een dag waarop je er minstens ${MARATHON_DOEL} speelde.`,
      behaald: feiten.perfecteDag,
    },
    {
      id: "perfectionist",
      naam: "Perfectionist",
      emoji: "💎",
      omschrijving: `Speel minstens ${PERFECTIONIST_DOEL} matches en verlies er geen enkele.`,
      behaald: gespeeld >= PERFECTIONIST_DOEL && gewonnen === gespeeld,
    },
  );

  // 4) Nog een lading — ludiek, vreemd en (bijna) onmogelijk. Negatieve eerst,
  //    de knapste achteraan.
  badges.push(
    {
      id: "struikelaar",
      naam: "Struikelaar",
      emoji: "🍌",
      omschrijving: `Verlies van een team dat gemiddeld minstens ${REUZENDODER_DREMPEL} punten lager staat — de omgekeerde reuzendoder.`,
      behaald: ratings ? isGestruikeld(matches, teams, playerId, ratings) : false,
    },
    {
      id: "lunchmatch",
      naam: "Lunchmatch",
      emoji: "🥪",
      omschrijving: "Speel een match tussen 12 en 14 uur — padel als middagpauze.",
      behaald: feiten.lunch,
    },
    {
      id: "spijbelaar",
      naam: "Spijbelaar",
      emoji: "🕴️",
      omschrijving: "Speel op een werkdag tussen 9 en 17 uur. Was je niet aan het werk?",
      behaald: feiten.kantooruren,
    },
    {
      id: "halloweenspook",
      naam: "Halloweenspook",
      emoji: "👻",
      omschrijving: "Speel een match op Halloween (31 oktober).",
      behaald: feiten.halloween,
    },
    {
      id: "sinterklaas",
      naam: "Sinterklaas",
      emoji: "🎁",
      omschrijving: "Speel een match op sinterklaas (5 december).",
      behaald: feiten.sinterklaas,
    },
    {
      id: "vrijdag-de-13e",
      naam: "Vrijdag de 13e",
      emoji: "🐈‍⬛",
      omschrijving: "Tart het lot: speel een match op een vrijdag de 13e.",
      behaald: feiten.vrijdag13,
    },
    {
      id: "schrikkelspringer",
      naam: "Schrikkelspringer",
      emoji: "🐸",
      omschrijving: "Speel op 29 februari — dat kan maar eens in de vier jaar.",
      behaald: feiten.schrikkeldag,
    },
    {
      id: "dubbele-cijfers",
      naam: "Dubbele cijfers",
      emoji: "🔢",
      omschrijving: `Win een match waarin je minstens ${DUBBELE_CIJFERS_DREMPEL} games pakt.`,
      behaald: feiten.dubbeleCijfers,
    },
    {
      id: "fotofinish",
      naam: "Fotofinish",
      emoji: "📸",
      omschrijving: `Win ${FOTOFINISH_DOEL} matches met exact één punt verschil.`,
      behaald: feiten.nagelbijterAantal >= FOTOFINISH_DOEL,
      voortgang: { nu: feiten.nagelbijterAantal, doel: FOTOFINISH_DOEL },
    },
    {
      id: "yin-yang",
      naam: "Yin-yang",
      emoji: "☯️",
      omschrijving: `Sta na minstens ${YINYANG_DOEL} matches op exact evenveel winst als verlies.`,
      behaald: gespeeld >= YINYANG_DOEL && gewonnen === verloren,
    },
    {
      id: "kalenderslokker",
      naam: "Kalenderslokker",
      emoji: "🗓️",
      omschrijving: `Speel in alle ${KALENDER_DOEL} maanden van het jaar.`,
      behaald: feiten.maandenAantal >= KALENDER_DOEL,
      voortgang: { nu: feiten.maandenAantal, doel: KALENDER_DOEL },
    },
    {
      id: "feniks",
      naam: "Feniks",
      emoji: "🐦‍🔥",
      omschrijving: `Herrijs uit de as: win een match ná ${PECHVOGEL_DREMPEL} verliezen op rij.`,
      behaald: hadComeback(matches, teams, playerId, PECHVOGEL_DREMPEL),
    },
  );

  // 5) De nieuwe lading (#119) — zelfde afspraak: pech en tegenslag eerst, de
  //    knapste prestaties achteraan zodat die bovenaan de deel-kaart komen.
  badges.push(
    {
      id: "diepzeeduiker",
      naam: "Diepzeeduiker",
      emoji: "🤿",
      omschrijving: `Zak onder een rating van ${DIEPZEE_DREMPEL} — vanaf hier kan het alleen beter.`,
      behaald: eigenRating != null && eigenRating < DIEPZEE_DREMPEL,
    },
    {
      id: "verloren-zoon",
      naam: "De verloren zoon",
      emoji: "🐐",
      omschrijving: `Sta weer op de baan na minstens ${VERLOREN_ZOON_DAGEN} dagen zonder match.`,
      behaald: rust.maxKloofDagen >= VERLOREN_ZOON_DAGEN,
    },
    {
      id: "achtbaan",
      naam: "Achtbaan",
      emoji: "🎢",
      omschrijving: "Win én verlies een match op dezelfde dag.",
      behaald: feiten.achtbaan,
    },
    {
      id: "jojo",
      naam: "Jojo",
      emoji: "🪀",
      omschrijving: `Wissel ${JOJO_DOEL} matches lang telkens winst en verlies af.`,
      behaald: jojo >= JOJO_DOEL,
      voortgang: { nu: jojo, doel: JOJO_DOEL },
    },
    // Tijd & kalender.
    {
      id: "valentijnsdate",
      naam: "Valentijnsdate",
      emoji: "💘",
      omschrijving: "Speel op Valentijn — je racket is toch je enige date.",
      behaald: feiten.valentijn,
    },
    {
      id: "oudejaarsknaller",
      naam: "Oudejaarsknaller",
      emoji: "🧨",
      omschrijving: "Sluit het jaar af met een match op 31 december.",
      behaald: feiten.oudejaar,
    },
    {
      id: "geen-grap",
      naam: "Geen grap",
      emoji: "🃏",
      omschrijving: "Win een match op 1 april — echt waar.",
      behaald: feiten.aprilWinst,
    },
    {
      id: "palindroomdag",
      naam: "Palindroomdag",
      emoji: "🪞",
      omschrijving: "Speel op een palindroomdatum, zoals 22-02-2022.",
      behaald: feiten.palindroomdag,
    },
    {
      id: "winterkoning",
      naam: "Winterkoning",
      emoji: "🥶",
      omschrijving: "Trotseer de kou: speel in december, januari én februari.",
      behaald: feiten.winterkoning,
    },
    {
      id: "dubbele-dienst",
      naam: "Dubbele dienst",
      emoji: "🌗",
      omschrijving: "Speel op één dag zowel vóór 12 uur als na 18 uur.",
      behaald: feiten.dubbeleDienst,
    },
    {
      id: "back-to-back",
      naam: "Back-to-back",
      emoji: "⏱️",
      omschrijving: `Start twee matches binnen ${BACK_TO_BACK_MINUTEN} minuten na elkaar.`,
      behaald: feiten.backToBack,
    },
    {
      id: "klokvast",
      naam: "Klokvast",
      emoji: "🕰️",
      omschrijving: `Speel ${KLOKVAST_DOEL} matches met exact dezelfde starttijd.`,
      behaald: feiten.maxZelfdeStarttijd >= KLOKVAST_DOEL,
      voortgang: { nu: feiten.maxZelfdeStarttijd, doel: KLOKVAST_DOEL },
    },
    {
      id: "weekritme",
      naam: "Weekritme",
      emoji: "📆",
      omschrijving: `Speel ${WEEKRITME_DOEL} weken op rij minstens één match.`,
      behaald: feiten.maxWekenOpRij >= WEEKRITME_DOEL,
      voortgang: { nu: feiten.maxWekenOpRij, doel: WEEKRITME_DOEL },
    },
    {
      id: "vier-seizoenen",
      naam: "Vier seizoenen",
      emoji: "🍂",
      omschrijving: "Speel in de lente, de zomer, de herfst én de winter.",
      behaald: feiten.vierSeizoenen,
    },
    // Zeldzaam & knap — de zwaarste achteraan.
    {
      id: "neutraal-zwitserland",
      naam: "Neutraal als Zwitserland",
      emoji: "🇨🇭",
      omschrijving: `Speel ${ZWITSERLAND_DOEL} keer gelijk.`,
      behaald: feiten.gelijk >= ZWITSERLAND_DOEL,
      voortgang: { nu: feiten.gelijk, doel: ZWITSERLAND_DOEL },
    },
    {
      id: "deja-vu",
      naam: "Déjà vu",
      emoji: "🔁",
      omschrijving: `Speel ${DEJAVU_DOEL} matches op rij met exact dezelfde eindscore.`,
      behaald: dejaVu >= DEJAVU_DOEL,
    },
    {
      id: "roestvrij",
      naam: "Roestvrij",
      emoji: "🦾",
      omschrijving: `Win meteen je eerste match na minstens ${ROESTVRIJ_DAGEN} dagen pauze.`,
      behaald: rust.winstNaRust,
    },
    {
      id: "sniper",
      naam: "Sniper",
      emoji: "🏹",
      omschrijving: `Win ${SNIPER_DOEL} matches met exact hetzelfde puntenverschil.`,
      behaald: feiten.maxZelfdeVerschilWinst >= SNIPER_DOEL,
      voortgang: { nu: feiten.maxZelfdeVerschilWinst, doel: SNIPER_DOEL },
    },
    {
      id: "puntenmachine",
      naam: "Puntenmachine",
      emoji: "🧮",
      omschrijving: `Pak in totaal ${PUNTENMACHINE_DOEL} games over al je matches.`,
      behaald: feiten.eigenGamesTotaal >= PUNTENMACHINE_DOEL,
      voortgang: { nu: feiten.eigenGamesTotaal, doel: PUNTENMACHINE_DOEL },
    },
    {
      id: "tweelingzielen",
      naam: "Tweelingzielen",
      emoji: "👯",
      omschrijving: `Win ${TWEELING_DOEL} matches op rij met dezelfde partner.`,
      behaald: tweeling >= TWEELING_DOEL,
      voortgang: { nu: tweeling, doel: TWEELING_DOEL },
    },
    {
      id: "angstgegner",
      naam: "Angstgegner verslagen",
      emoji: "😈",
      omschrijving: `Versla een team waarvan je eerst ${ANGSTGEGNER_DREMPEL} keer op rij verloor.`,
      behaald: angstgegnerVerslagen(matches, teams, playerId),
    },
  );

  // 6) Perfecte weken: alle weekmissies (missions.ts) van één week gehaald.
  //    Telt over de aangeleverde matches, zoals elke afgeleide badge.
  const perfect = perfecteWeken(matches, teams, playerId);
  for (const { doel, naam, emoji } of PERFECTE_WEKEN) {
    badges.push({
      id: `perfecte-weken-${doel}`,
      naam,
      emoji,
      omschrijving:
        doel === 1
          ? "Haal in één week álle weekmissies — een perfecte week."
          : `Haal ${doel} perfecte weken.`,
      behaald: perfect >= doel,
      voortgang: { nu: perfect, doel },
    });
  }

  // 7) Rating-mijlpalen (oplopend; "Levende legende" sluit de rij — de zeldzaamste).
  for (const { drempel, naam, emoji } of RATINGTIERS) {
    badges.push({
      id: `rating-${drempel}`,
      naam,
      emoji,
      omschrijving: `Bereik een rating van ${drempel}.`,
      behaald: eigenRating != null && eigenRating >= drempel,
      voortgang:
        eigenRating != null
          ? { nu: Math.round(eigenRating), doel: drempel }
          : undefined,
    });
  }

  return badges;
}
