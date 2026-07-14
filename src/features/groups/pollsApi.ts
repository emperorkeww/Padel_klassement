import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { Club } from "../availability/club";

// Speeldag-polls: een doodle met 1-5 kandidaat-momenten en banen als harde
// dependency. Losse typering (tabel-shim) tot database.types.ts opnieuw
// gegenereerd wordt; zelfde cache/RLS-patroon als attendanceApi.

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
};

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

type Err = { message: string } | null;
type SelectQuery<Row> = {
  eq: (c: string, v: string) => SelectQuery<Row>;
  order: (c: string, opts?: { ascending?: boolean }) => SelectQuery<Row>;
} & Promise<{ data: Row[] | null; error: Err }>;
type DeleteQuery = {
  eq: (c: string, v: string) => DeleteQuery;
} & Promise<{ error: Err }>;
type UpdateQuery = {
  eq: (c: string, v: string) => UpdateQuery;
} & Promise<{ error: Err }>;
type InsertQuery<Row> = {
  select: (cols?: string) => Promise<{ data: Row[] | null; error: Err }>;
};
type Table<Row> = {
  select: (cols: string) => SelectQuery<Row>;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => InsertQuery<Row>;
  update: (values: Record<string, unknown>) => UpdateQuery;
  delete: () => DeleteQuery;
  upsert: (
    values: Record<string, unknown>,
    opts: { onConflict: string },
  ) => Promise<{ error: Err }>;
};
const pollTable = () =>
  supabase.from("play_polls" as never) as unknown as Table<PlayPoll>;
const optionTable = () =>
  supabase.from("play_poll_options" as never) as unknown as Table<PollOption>;
const voteTable = () =>
  supabase.from("play_poll_votes" as never) as unknown as Table<PollVote>;

/** Alle polls van een groep, nieuwste eerst (RLS: alleen eigen groepen). */
export function getGroupPolls(groupId: string): Promise<PlayPoll[]> {
  return cached(`play-polls:${groupId}`, async () => {
    const { data, error } = await pollTable()
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

/** Alle opties van de polls van een groep. */
export function getGroupPollOptions(groupId: string): Promise<PollOption[]> {
  return cached(`play-poll-options:${groupId}`, async () => {
    const { data, error } = await optionTable()
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
    const { data, error } = await voteTable()
      .select("*")
      .eq("group_id", groupId);
    if (error) throw error;
    return data ?? [];
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
  const { data, error } = await pollTable()
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
  const { error: e2 } = await optionTable()
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
    await pollTable().delete().eq("id", poll.id);
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
  const { error } = await optionTable()
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
  const { error } = await optionTable().delete().eq("id", optionId);
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
  const { error } = await voteTable().upsert(
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
  const { error } = await voteTable()
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
  const { error } = await pollTable()
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
  const { error } = await pollTable()
    .update({
      status: "locked",
      locked_option_id: optionId,
      locked_at: new Date().toISOString(),
    })
    .eq("id", pollId);
  if (error) throw error;
  invalidate("play-poll");
}

/** Markeert de gelockte poll als geboekt op Playtomic. */
export async function markPollBooked(pollId: string): Promise<void> {
  const { error } = await pollTable()
    .update({ status: "booked", booked_at: new Date().toISOString() })
    .eq("id", pollId);
  if (error) throw error;
  invalidate("play-poll");
}

/** Heropent een gelockte poll: terug naar stemmen (maker of eigenaar). */
export async function reopenPoll(pollId: string): Promise<void> {
  const { error } = await pollTable()
    .update({
      status: "open",
      locked_option_id: null,
      locked_at: null,
      booked_at: null,
    })
    .eq("id", pollId);
  if (error) throw error;
  invalidate("play-poll");
}

/** Annuleert een poll (maker of eigenaar); stemmen blijven bewaard. */
export async function cancelPoll(pollId: string): Promise<void> {
  const { error } = await pollTable()
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
