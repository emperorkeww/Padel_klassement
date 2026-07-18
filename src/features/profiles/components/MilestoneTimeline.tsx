import { formatDate } from "@/lib/utils/format";
import { buildMilestones } from "@/features/profiles/milestones";
import type { RatingPoint } from "@/types";

// Milestone-chronologie (#471): een verticale tijdlijn met historische
// mijlpalen. Puur presentatie; buildMilestones levert de gesorteerde lijst.
// Toont niets bij een kale historie (alleen een debuut is te mager voor een
// tijdlijn).
export function MilestoneTimeline({ history }: { history: RatingPoint[] }) {
  const milestones = buildMilestones(history);
  if (milestones.length < 2) return null;

  return (
    <section className="card">
      <h2 className="card__title">Mijlpalen</h2>
      <ol className="timeline">
        {milestones.map((m) => (
          <li key={m.id} className="timeline__item">
            <span className="timeline__icon" aria-hidden="true">
              {m.icon}
            </span>
            <span className="timeline__label">{m.label}</span>
            <time className="timeline__date" dateTime={m.date}>
              {formatDate(m.date)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default MilestoneTimeline;
