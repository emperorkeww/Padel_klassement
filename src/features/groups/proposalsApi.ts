import { supabase } from "../../lib/supabase";
import { cached, invalidate } from "../../lib/queryCache";

// Speelvoorstellen per groep: een lid stelt een concreet moment voor en de rest
// reageert met yes/maybe/no. Zelfde losse typering en cache/RLS-patroon als
// planApi.ts (slot_availability), tot database.types.ts opnieuw gegenereerd is.

export type ProposalStatus = "yes" | "no" | "maybe";

export type PlayProposal = {
  id: string;
  group_id: string;
  created_by: string;
  date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM" clubtijd
  courts: number;
  club_name: string | null;
  created_at: string;
};

export type ProposalVote = {
  proposal_id: string;
  group_id: string;
  player_id: string;
  status: ProposalStatus;
  updated_at: string;
};

type Err = { message: string } | null;
type SelectQuery<Row> = {
  eq: (c: string, v: string) => SelectQuery<Row>;
  gte: (c: string, v: string) => SelectQuery<Row>;
  order: (c: string, opts?: { ascending?: boolean }) => SelectQuery<Row>;
} & Promise<{ data: Row[] | null; error: Err }>;
type DeleteQuery = {
  eq: (c: string, v: string) => DeleteQuery;
} & Promise<{ error: Err }>;
type InsertQuery<Row> = {
  select: (cols?: string) => Promise<{ data: Row[] | null; error: Err }>;
};
type Table<Row> = {
  select: (cols: string) => SelectQuery<Row>;
  insert: (values: Record<string, unknown>) => InsertQuery<Row>;
  delete: () => DeleteQuery;
  upsert: (
    values: Record<string, unknown>,
    opts: { onConflict: string },
  ) => Promise<{ error: Err }>;
};
function proposalTable(): Table<PlayProposal> {
  return supabase.from("play_proposals" as never) as unknown as Table<PlayProposal>;
}
function voteTable(): Table<ProposalVote> {
  return supabase.from(
    "play_proposal_votes" as never,
  ) as unknown as Table<ProposalVote>;
}

/** Voorstellen van een groep vanaf een datum (RLS: alleen eigen groepen). */
export function getGroupProposals(
  groupId: string,
  fromDate: string,
): Promise<PlayProposal[]> {
  return cached(`play-proposals:${groupId}:${fromDate}`, async () => {
    const { data, error } = await proposalTable()
      .select("*")
      .eq("group_id", groupId)
      .gte("date", fromDate)
      .order("date")
      .order("start_time");
    if (error) throw error;
    return data ?? [];
  });
}

/** Alle reacties op de (komende) voorstellen van een groep. */
export function getGroupProposalVotes(groupId: string): Promise<ProposalVote[]> {
  return cached(`play-proposal-votes:${groupId}`, async () => {
    const { data, error } = await voteTable()
      .select("*")
      .eq("group_id", groupId);
    if (error) throw error;
    return data ?? [];
  });
}

/** Doet een nieuw voorstel; de indiener doet automatisch zelf mee. */
export async function createProposal(input: {
  groupId: string;
  createdBy: string;
  date: string;
  startTime: string;
  courts: number;
  clubName: string | null;
}): Promise<void> {
  const { data, error } = await proposalTable()
    .insert({
      group_id: input.groupId,
      created_by: input.createdBy,
      date: input.date,
      start_time: input.startTime,
      courts: input.courts,
      club_name: input.clubName,
    })
    .select();
  if (error) throw error;
  invalidate("play-proposals");
  // De indiener stelt voor omdat hij zelf kan: meteen een "yes" erbij.
  const mine = data?.[0];
  if (mine) {
    await setProposalVote(mine.id, input.groupId, input.createdBy, "yes");
  }
}

/** Trekt een voorstel in (RLS: alleen de indiener of de groepseigenaar). */
export async function deleteProposal(proposalId: string): Promise<void> {
  const { error } = await proposalTable().delete().eq("id", proposalId);
  if (error) throw error;
  invalidate("play-proposal");
}

/** Zet (of wijzigt) je eigen reactie op een voorstel. */
export async function setProposalVote(
  proposalId: string,
  groupId: string,
  playerId: string,
  status: ProposalStatus,
): Promise<void> {
  const { error } = await voteTable().upsert(
    {
      proposal_id: proposalId,
      group_id: groupId,
      player_id: playerId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "proposal_id,player_id" },
  );
  if (error) throw error;
  invalidate("play-proposal-votes");
}

/**
 * Stuurt via de edge function "remind-group" een push naar de groepsleden die
 * nog niet op dit voorstel reageerden. Geeft terug hoeveel leden herinnerd zijn.
 */
export async function remindProposal(
  groupId: string,
  proposalId: string,
): Promise<number> {
  const { data, error } = await supabase.functions.invoke<{ reminded: number }>(
    "remind-group",
    { body: { group_id: groupId, proposal_id: proposalId } },
  );
  if (error) throw error;
  return data?.reminded ?? 0;
}

/** Haalt je eigen reactie weg ("Wissen"). */
export async function clearProposalVote(
  proposalId: string,
  playerId: string,
): Promise<void> {
  const { error } = await voteTable()
    .delete()
    .eq("proposal_id", proposalId)
    .eq("player_id", playerId);
  if (error) throw error;
  invalidate("play-proposal-votes");
}
