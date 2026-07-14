import { type ReactNode } from "react";
import { CountUp } from "@/ui/CountUp";

export function Stat({
  label,
  value,
  accent,
  delta,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  delta?: ReactNode;
}) {
  return (
    <div className={`stat ${accent ? "stat--accent" : ""}`}>
      <span className="stat__value">
        {typeof value === "number" ? <CountUp value={value} /> : value}
        {delta}
      </span>
      <span className="stat__label">{label}</span>
    </div>
  );
}
