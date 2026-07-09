import { supabase } from "../../lib/supabase";
import { cached, invalidate } from "../../lib/queryCache";

// Speeldag-polls: een doodle met 1-5 kandidaat-momenten en banen als harde
// dependency. Zelfde losse typering en cache/RLS-patroon als planApi.ts, tot
// database.types.ts opnieuw gegenereerd wordt.

export type PollStatus = "open" | "locked" | "booked" | "cancelled";
export type PollVoteStatus = "yes" | "no" | "maybe";

export type PlayPoll = {
  id: string;
  group_id: string;
  created_by: string;
  status: PollStatus;
  locked_option_id: string | null;
  created_at: string;
};

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

/** Start een poll met 1-5 kandidaat-momenten. */
export async function createPoll(input: {
  groupId: string;
  createdBy: string;
  options: NewPollOption[];
}): Promise<void> {
  const { data, error } = await pollTable()
    .insert({ group_id: input.groupId, created_by: input.createdBy })
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

/** Legt het winnende moment vast (RLS: maker of groepseigenaar). */
export async function lockPoll(pollId: string, optionId: string): Promise<void> {
  const { error } = await pollTable()
    .update({ status: "locked", locked_option_id: optionId })
    .eq("id", pollId);
  if (error) throw error;
  invalidate("play-poll");
}

/** Markeert de gelockte poll als geboekt op Playtomic. */
export async function markPollBooked(pollId: string): Promise<void> {
  const { error } = await pollTable()
    .update({ status: "booked" })
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
