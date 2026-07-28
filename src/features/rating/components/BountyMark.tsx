import { BOUNTY_EMOJI } from "@/features/rating/bounty";

/** 🎯 met de actuele waarde naast de naam van een bounty-drager (#805).
 *  Zelfde formaat als de schande-tokens ernaast (StandMarks, #523): klein,
 *  niet meegeknipt door een ellipsis-naam, betekenis in het `title`. */
export function BountyMark({ pool }: { pool: number | null | undefined }) {
  if (pool == null) return null;
  return (
    <span
      className="stand-mark bounty-mark"
      title={`Bounty: wie hem verslaat, pakt ${pool} Elo`}
    >
      <span aria-hidden="true">{BOUNTY_EMOJI}</span>
      <span className="bounty-mark__waarde">{pool}</span>
      <span className="sr-only">{`bounty van ${pool} Elo`}</span>
    </span>
  );
}