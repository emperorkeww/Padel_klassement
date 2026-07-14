import { useEffect } from "react";
import {
  deriveMissions,
  weekIndex,
  weekStartOf,
} from "../missions";
import { celebrate } from "@/lib/utils/confetti";
import { readFlag, writeFlag } from "../flags";
import type { Match, Team } from "@/types";

/* ---------- Weekmissies (#118): kleine, verversende doelen per week ---------- */
export function WeekMissions({
  matches,
  teams,
  myId,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  myId: string;
}) {
  const nu = new Date();
  const weekIdx = weekIndex(nu);
  const missies = deriveMissions(matches, teams, myId, nu);
  const allesBehaald = missies.every((m) => m.behaald);

  const start = weekStartOf(nu);
  const eind = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 12);
  const fmt = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });

  // Vier elke missie hoogstens één keer: flag per week + missie, zodat de
  // teller elke maandag vanzelf reset. Eén confettisalvo per pass, ook als
  // meerdere missies tegelijk binnenkomen (bv. na een realtime refresh).
  const seintje = missies.map((m) => `${m.id}:${m.behaald}`).join(",");
  useEffect(() => {
    let vier = false;
    for (const m of missies) {
      if (!m.behaald) continue;
      const key = `missie-gevierd:${weekIdx}:${m.id}`;
      if (!readFlag(key)) {
        writeFlag(key);
        vier = true;
      }
    }
    if (allesBehaald) {
      const key = `perfecte-week-gevierd:${weekIdx}`;
      if (!readFlag(key)) {
        writeFlag(key);
        vier = true;
      }
    }
    if (vier) celebrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seintje]);

  return (
    <section className="card week-missions" aria-label="Weekmissies">
      <div className="card__head">
        <h2 className="card__title">Weekmissies</h2>
        <span className="week-missions__range">
          {fmt.format(start)} – {fmt.format(eind)}
        </span>
      </div>
      <ul className="missions">
        {missies.map((m) => (
          <li
            key={m.id}
            className={`missions__item ${m.behaald ? "is-done" : ""}`}
          >
            <span className="missions__emoji" aria-hidden="true">
              {m.emoji}
            </span>
            <span className="missions__body">
              <span className="missions__name">{m.naam}</span>
              <span className="missions__hint">{m.omschrijving}</span>
            </span>
            {m.behaald ? (
              <span className="missions__check" aria-label="behaald">
                ✓
              </span>
            ) : (
              <span className="missions__count">
                {m.voortgang.nu}/{m.voortgang.doel}
              </span>
            )}
            <span
              className="missions__bar"
              role="progressbar"
              aria-label={m.naam}
              aria-valuenow={m.voortgang.nu}
              aria-valuemin={0}
              aria-valuemax={m.voortgang.doel}
            >
              <span
                className="missions__fill"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((m.voortgang.nu / m.voortgang.doel) * 100),
                  )}%`,
                }}
              />
            </span>
          </li>
        ))}
      </ul>
      {allesBehaald && (
        <p className="missions__perfect">
          🎉 Perfecte week! Dit telt mee voor de Weekheld-badge.
        </p>
      )}
    </section>
  );
}
