import { type NextFreeSlot } from "@/features/availability/api";

export function NextFreeLine({ slot }: { slot: NextFreeSlot | null }) {
  if (!slot) return <p className="avail-next">Vandaag niets meer vrij.</p>;
  const extra = slot.courts.length - 1;
  return (
    <p className="avail-next">
      Eerstvolgend vrij:{" "}
      <strong className="avail-next__time">{slot.time}</strong> ·{" "}
      {slot.courts[0].name}
      {extra > 0 &&
        ` (+${extra} ${extra === 1 ? "andere baan" : "andere banen"})`}
    </p>
  );
}