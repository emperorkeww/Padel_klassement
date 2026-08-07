// Meldingen: wat een melding ís, en wie er push van krijgt (#1090).
//
// Tot #1090 bestond een melding alleen als web-push. Vier functies bouwden elk
// hun eigen bericht en draaiden daarna elk hun eigen, vrijwel identieke
// webpush-lus: send-push, match-reminders, poll-deadline en remind-group. Wie
// geen abonnement had zag niets, en wie de melding wegveegde was ze kwijt.
//
// Nu is een melding eerst een rij in public.notifications en daarna pas een
// push. De volgorde is het hele punt: de rij mag niet afhangen van de bezorging
// en niet van de notify_*-voorkeuren.
//
// Dit bestand raakt bewust géén Deno-globals en importeert geen `npm:`-modules,
// zodat de beslissingen los te unit-testen zijn met vitest (zie meldingen.test.ts
// en de include-lijst in vite.config.ts) — hetzelfde patroon als cronAuth.ts en
// aiPortret.ts. Het bezorgen zelf staat in meldingenBezorger.ts.

/** De gebeurtenis, niet het kanaal. Gelijk aan de check-constraint op
 *  public.notifications.soort (schemas/tables/27_notifications.sql). */
export type Soort =
  | "nieuwe_ronde"
  | "uitslag"
  | "vriendschapsverzoek"
  | "rangwissel"
  | "pias"
  | "poll"
  | "var"
  | "speeldag_herinnering"
  | "lef";

export type Melding = {
  recipients: string[];
  title: string;
  body: string;
  url: string;
  soort: Soort;
  /** Notificatie-tag (#189): meldingen met dezelfde tag vervangen elkaar op het
   *  toestel, en vouwen in de inbox samen zolang ze ongelezen zijn. Bewust per
   *  gebeurtenis, niet per soort — zo wordt een reeks ineens gegenereerde rondes
   *  (#827) één melding, terwijl twee losse matches gewoon los blijven staan. */
  tag: string;
};

/** Eén rij voor public.meldingen_schrijven. */
export type MeldingRij = {
  user_id: string;
  soort: Soort;
  title: string;
  body: string;
  url: string;
  tag: string;
};

/**
 * Soort → de notify_*-kolom op profiles die de bezórging stuurt, of null als er
 * geen schakelaar voor bestaat.
 *
 * Vervangt de twee half-overlappende filters van vóór #1090: PREF_COLUMN in
 * send-push (op een eigen `MessageKind`) en withReminderPref in match-reminders.
 * De schakelaars bepalen enkel of het toestel piept — de rij komt er hoe dan ook,
 * dus de filter draait ná het schrijven.
 */
export const VOORKEUR_KOLOM: Record<Soort, string | null> = {
  nieuwe_ronde: "notify_new_round",
  uitslag: "notify_result",
  vriendschapsverzoek: "notify_friend_request",
  rangwissel: "notify_rank_change",
  speeldag_herinnering: "notify_match_reminder",
  // De lef-onthulling bij de aftrap (#804) hangt bewust aan dezelfde schakelaar
  // als de herinnering: wie geen match-meldingen wil, wil deze ook niet.
  lef: "notify_match_reminder",
  // Polls, VAR en pias hebben geen eigen schakelaar. Pias filtert zichzelf al
  // via roast_schild, in send-push zelf.
  poll: null,
  var: null,
  pias: null,
};

/** De rijen die bij een lijst meldingen horen, in volgorde: bij twee keer
 *  dezelfde (ontvanger, tag) wint de laatste — zo leest meldingen_schrijven het
 *  ook. Ontvangers worden ontdubbeld, want twee identieke rijen zouden anders
 *  binnen één statement met elkaar botsen. */
export function meldingRijen(meldingen: Melding[]): MeldingRij[] {
  return meldingen.flatMap((m) =>
    [...new Set(m.recipients.filter(Boolean))].map((user_id) => ({
      user_id,
      soort: m.soort,
      title: m.title,
      body: m.body,
      url: m.url,
      tag: m.tag,
    }))
  );
}

/**
 * Laat alleen de ontvangers over die dit soort push niet hebben uitgezet.
 *
 * Fail-open, zoals vóór #1090: een profiel dat niet in `profielen` zit (of een
 * queryfout, die zich hier voordoet als een lege lijst) krijgt gewoon zijn push.
 * Alleen een expliciete `false` sluit iemand uit.
 */
export function zonderUitgezet(
  recipients: string[],
  kolom: string | null,
  profielen: Record<string, unknown>[],
): string[] {
  if (!kolom || recipients.length === 0) return recipients;
  const uit = new Set(
    profielen
      .filter((p) => p[kolom] === false)
      .map((p) => p.id as string),
  );
  return recipients.filter((id) => !uit.has(id));
}
