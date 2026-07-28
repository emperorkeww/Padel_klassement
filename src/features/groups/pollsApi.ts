import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import {
  normalizeAccessCode,
  normalizeCourts,
} from "@/features/groups/planPollHelpers";
import type { Club } from "@/features/availability/club";

// Speeldag-polls: een doodle met 1-5 kandidaat-momenten en banen als harde
// dependency. Zelfde cache/RLS-patroon als attendanceApi. De status-kolommen
// zijn in de DB text met een CHECK; hier smaller getypt als union.

export type PollStatus = "open" | "locked" | "booked" | "cancelled";
export type PollVoteStatus = "yes" | "no" | "maybe";

export type PlayPoll = {
  id: string;
  group_id: string;
  created_by: string;
  status: PollStatus;
  locked_option_id: string | null;
  created_at: string;
  /** Momenten van vastleggen/boeken (feed v2, #143); null tot die stap. */
  locked_at: string | null;
  booked_at: string | null;
  /** Locatie-snapshot (#322): de club waarvoor deze poll is aangemaakt. Los van
   *  de globale clubkeuze, zodat een latere wissel bestaande polls niet raakt. */
  club_id: string;
  club_name: string;
  club_city: string | null;
  club_timezone: string;
  /** Toegangscode van de velden (#675); null als de club er geen heeft of hij
   *  nog niet bekend is. Alleen groepsleden krijgen 'm (RLS). */
  access_code: string | null;
  /** Geboekte baan/banen (#802), vrije tekst zoals de code; null zolang de
   *  boeker ze niet invulde. Ook member-only. */
  courts: string | null;
};

/**
 * Wat er bij een boeking naast "geboekt ✓" hoort: waar sta je (banen, #802) en
 * hoe raak je binnen (code, #675). Beide optioneel en los van elkaar — een veld
 * weglaten laat de kolom ongemoeid, expliciet null wist 'm.
 */
export type BookingDetails = {
  accessCode?: string | null;
  courts?: string | null;
};

/** De ingevulde velden als kolom-update; ontbrekende velden blijven weg. */
function bookingPatch(details: BookingDetails) {
  return {
    ...(details.accessCode !== undefined
      ? { access_code: normalizeAccessCode(details.accessCode) }
      : {}),
    ...(details.courts !== undefined
      ? { courts: normalizeCourts(details.courts) }
      : {}),
  };
}

/**
 * Absolute deep-link naar één speeldag (#675) — spiegel van slotShareUrl. Tot
 * nu toe was een poll niet adresseerbaar: je kwam op ?tab=plannen uit en
 * focusPoll besliste wélke speeldag je zag. Met `poll` in de URL opent de
 * gedeelde speeldag zelf.
 *
 * Member-only, en bewust zo: play_polls_select_member laat alleen groepsleden
 * de poll lezen. Dat dekt "even doorsturen in de groepschat" zonder nieuwe
 * publieke oppervlakte; voor iemand buiten de groep is de groepsuitnodiging
 * (/groepen/join/:token) de weg.
 */
export function pollShareUrl(groupId: string, pollId: string): string {
  const params = new URLSearchParams({ tab: "plannen", poll: pollId });
  return `${window.location.origin}/groepen/${groupId}?${params.toString()}`;
}

/** De op een poll opgeslagen locatie als Club-object (voor de UI/availability). */
export function pollClub(poll: PlayPoll): Club {
  return {
    id: poll.club_id,
    name: poll.club_name,
    city: poll.club_city ?? "",
    timezone: poll.club_timezone,
  };
}

export type PollOption = {
  id: string;
  poll_id: string;
  group_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM" clubtijd
  duration: number; // 60 | 90 | 120
  /** Vrije banen bij aanmaak; null = beschikbaarheid onbekend. */
  courts_free: number | null;
  created_at: string;
};

export type PollVote = {
  option_id: string;
  group_id: string;
  player_id: string;
  status: PollVoteStatus;
  updated_at: string;
};

/** Alle polls van een groep, nieuwste eerst (RLS: alleen eigen groepen). */
export function getGroupPolls(groupId: string): Promise<PlayPoll[]> {
  return cached(`play-polls:${groupId}`, async () => {
    const { data, error } = await supabase
      .from("play_polls")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PlayPoll[];
  });
}

/** Alle opties van de polls van een groep. */
export function getGroupPollOptions(groupId: string): Promise<PollOption[]> {
  return cached(`play-poll-options:${groupId}`, async () => {
    const { data, error } = await supabase
      .from("play_poll_options")
      .select("*")
      .eq("group_id", groupId)
      .order("date")
      .order("start_time");
    if (error) throw error;
    return data ?? [];
  });
}

/** Alle stemmen op de polls van een groep. */
export function getGroupPollVotes(groupId: string): Promise<PollVote[]> {
  return cached(`play-poll-votes:${groupId}`, async () => {
    const { data, error } = await supabase
      .from("play_poll_votes")
      .select("*")
      .eq("group_id", groupId);
    if (error) throw error;
    return (data ?? []) as PollVote[];
  });
}

// Gebundelde varianten voor het dashboard (#736). Dat scherm heeft de polls van
// ál mijn groepen tegelijk nodig; per groep drie losse queries betekende 3×G
// requests bij elke mount. Eén query met `in(group_id, …)` doet hetzelfde werk.
// De sleutels houden dezelfde prefixen als de per-groep-varianten, zodat
// CACHE_PREFIXES ("play-poll", "play-poll-options", "play-poll-votes") ze
// blijft invalideren bij realtime-events en mutaties.
//
// Bewust náást getGroupPolls c.s.: GroupDetail werkt met één groep en deelt die
// per-groep-sleutel met de rest van het scherm.

/** Stabiele cache-sleutel voor een set groep-id's (volgorde-onafhankelijk). */
function groupsKey(prefix: string, groupIds: string[]): string {
  return `${prefix}:groups:${[...new Set(groupIds)].sort().join(",")}`;
}

/** Groepeert rijen met een group_id op groep; groepen zonder rijen ontbreken. */
function perGroup<T extends { group_id: string }>(rows: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const row of rows) (out[row.group_id] ??= []).push(row);
  return out;
}

/** Polls van meerdere groepen in één query, nieuwste eerst, per groep. */
export function getPollsForGroups(
  groupIds: string[],
): Promise<Record<string, PlayPoll[]>> {
  if (groupIds.length === 0) return Promise.resolve({});
  return cached(groupsKey("play-polls", groupIds), async () => {
    const { data, error } = await supabase
      .from("play_polls")
      .select("*")
      .in("group_id", groupIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return perGroup((data ?? []) as PlayPoll[]);
  });
}

/** Poll-opties van meerdere groepen in één query, per groep. */
export function getPollOptionsForGroups(
  groupIds: string[],
): Promise<Record<string, PollOption[]>> {
  if (groupIds.length === 0) return Promise.resolve({});
  return cached(groupsKey("play-poll-options", groupIds), async () => {
    const { data, error } = await supabase
      .from("play_poll_options")
      .select("*")
      .in("group_id", groupIds)
      .order("date")
      .order("start_time");
    if (error) throw error;
    return perGroup((data ?? []) as PollOption[]);
  });
}

/** Poll-stemmen van meerdere groepen in één query, per groep. */
export function getPollVotesForGroups(
  groupIds: string[],
): Promise<Record<string, PollVote[]>> {
  if (groupIds.length === 0) return Promise.resolve({});
  return cached(groupsKey("play-poll-votes", groupIds), async () => {
    const { data, error } = await supabase
      .from("play_poll_votes")
      .select("*")
      .in("group_id", groupIds);
    if (error) throw error;
    return perGroup((data ?? []) as PollVote[]);
  });
}

export type NewPollOption = {
  date: string;
  startTime: string;
  duration: number;
  /** Vrije banen op het moment van kiezen; null = onbekend. */
  courtsFree: number | null;
};

/** Start een poll met 1-5 kandidaat-momenten op de gekozen club (#322). */
export async function createPoll(input: {
  groupId: string;
  createdBy: string;
  club: Club;
  options: NewPollOption[];
}): Promise<void> {
  const { data, error } = await supabase
    .from("play_polls")
    .insert({
      group_id: input.groupId,
      created_by: input.createdBy,
      club_id: input.club.id,
      club_name: input.club.name,
      club_city: input.club.city,
      club_timezone: input.club.timezone,
    })
    .select();
  if (error) throw error;
  const poll = data?.[0];
  if (!poll) throw new Error("Poll aanmaken mislukte.");
  const { error: e2 } = await supabase
    .from("play_poll_options")
    .insert(
      input.options.map((o) => ({
        poll_id: poll.id,
        group_id: input.groupId,
        date: o.date,
        start_time: o.startTime,
        duration: o.duration,
        courts_free: o.courtsFree,
      })),
    )
    .select();
  if (e2) {
    // Opties weigeren → geen halve poll laten rondslingeren.
    await supabase.from("play_polls").delete().eq("id", poll.id);
    throw e2;
  }
  invalidate("play-poll");
}

/**
 * Voegt een kandidaat-moment toe aan een open poll ("Dagen aanpassen").
 * RLS: alleen de maker of groepseigenaar, en alleen bij status open.
 */
export async function addPollOption(
  pollId: string,
  groupId: string,
  option: NewPollOption,
): Promise<void> {
  const { error } = await supabase
    .from("play_poll_options")
    .insert({
      poll_id: pollId,
      group_id: groupId,
      date: option.date,
      start_time: option.startTime,
      duration: option.duration,
      courts_free: option.courtsFree,
    })
    .select();
  if (error) throw error;
  invalidate("play-poll");
}

/**
 * Verwijdert een kandidaat-moment uit een open poll; stemmen op dat moment
 * vervallen mee (cascade). RLS: maker/eigenaar, alleen bij status open.
 */
export async function removePollOption(optionId: string): Promise<void> {
  const { error } = await supabase
    .from("play_poll_options")
    .delete()
    .eq("id", optionId);
  if (error) throw error;
  invalidate("play-poll");
}

/** Zet (of wijzig) je eigen stem op één optie. */
export async function setPollVote(
  optionId: string,
  groupId: string,
  playerId: string,
  status: PollVoteStatus,
): Promise<void> {
  const { error } = await supabase.from("play_poll_votes").upsert(
    {
      option_id: optionId,
      group_id: groupId,
      player_id: playerId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "option_id,player_id" },
  );
  if (error) throw error;
  invalidate("play-poll-votes");
}

/** Haalt je eigen stem op één optie weg. */
export async function clearPollVote(
  optionId: string,
  playerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("play_poll_votes")
    .delete()
    .eq("option_id", optionId)
    .eq("player_id", playerId);
  if (error) throw error;
  invalidate("play-poll-votes");
}

/**
 * Wijzigt de locatie (club) van een poll — voor de "wijzig locatie"-actie bij
 * open/locked polls (#322). De aanroeper gate't op status: een geboekte poll
 * bevriest z'n locatie. RLS: maker of groepseigenaar.
 */
export async function setPollClub(pollId: string, club: Club): Promise<void> {
  const { error } = await supabase
    .from("play_polls")
    .update({
      club_id: club.id,
      club_name: club.name,
      club_city: club.city,
      club_timezone: club.timezone,
    })
    .eq("id", pollId);
  if (error) throw error;
  invalidate("play-poll");
}

/** Legt het winnende moment vast (RLS: maker of groepseigenaar). */
export async function lockPoll(pollId: string, optionId: string): Promise<void> {
  const { error } = await supabase
    .from("play_polls")
    .update({
      status: "locked",
      locked_option_id: optionId,
      locked_at: new Date().toISOString(),
    })
    .eq("id", pollId);
  if (error) throw error;
  invalidate("play-poll");
}

/**
 * Markeert de gelockte poll als geboekt op Playtomic. `details` is optioneel
 * (#675, #802): laat een veld weg en die kolom blijft ongemoeid — boeken zonder
 * banen of code is nog altijd één actie. Meegeven (ook als lege string of null)
 * zet de waarde, zodat hetzelfde invoerveld ook "niet ingevuld" kan betekenen.
 */
export async function markPollBooked(
  pollId: string,
  details: BookingDetails = {},
): Promise<void> {
  const { error } = await supabase
    .from("play_polls")
    .update({
      status: "booked",
      booked_at: new Date().toISOString(),
      ...bookingPatch(details),
    })
    .eq("id", pollId);
  if (error) throw error;
  invalidate("play-poll");
}

/**
 * Zet, wijzigt of wist de banen en/of de toegangscode van de boeking
 * (#675, #802). Apart van markPollBooked omdat die gegevens in de praktijk vaak
 * pas ná het boeken binnenkomen (bevestigingsmail) — zonder dit zou je de poll
 * moeten heropenen. RLS: play_polls_update_manager (maker of groepseigenaar),
 * zonder statusfilter.
 */
export async function setPollBookingDetails(
  pollId: string,
  details: BookingDetails,
): Promise<void> {
  const { error } = await supabase
    .from("play_polls")
    .update(bookingPatch(details))
    .eq("id", pollId);
  if (error) throw error;
  invalidate("play-poll");
}

/** Heropent een gelockte poll: terug naar stemmen (maker of eigenaar). */
export async function reopenPoll(pollId: string): Promise<void> {
  const { error } = await supabase
    .from("play_polls")
    .update({
      status: "open",
      locked_option_id: null,
      locked_at: null,
      booked_at: null,
      // De boeking vervalt, dus de code (#675) en de banen (#802) van díé
      // boeking ook — anders blijft een oude clubcode of baannummer achter op
      // een poll die opnieuw open staat.
      access_code: null,
      courts: null,
    })
    .eq("id", pollId);
  if (error) throw error;
  invalidate("play-poll");
}

/** Annuleert een poll (maker of eigenaar); stemmen blijven bewaard. */
export async function cancelPoll(pollId: string): Promise<void> {
  const { error } = await supabase
    .from("play_polls")
    .update({ status: "cancelled", locked_option_id: null })
    .eq("id", pollId);
  if (error) throw error;
  invalidate("play-poll");
}

/**
 * Stuurt via de edge function "remind-group" een push naar groepsleden die
 * nog op geen enkele optie van deze poll stemden.
 */
export async function remindPoll(
  groupId: string,
  pollId: string,
): Promise<number> {
  const { data, error } = await supabase.functions.invoke<{ reminded: number }>(
    "remind-group",
    { body: { group_id: groupId, poll_id: pollId } },
  );
  if (error) throw error;
  return data?.reminded ?? 0;
}
