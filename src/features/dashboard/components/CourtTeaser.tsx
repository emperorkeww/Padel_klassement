import { Link } from "react-router-dom";
import { Skeleton } from "@/ui/Skeleton";
import { nextFreeSlot, type DayAvailability } from "@/features/availability/api";
import type { AsyncState } from "@/lib/hooks/useAsync";
import { minutesNowInZone } from "@/lib/utils/time";
import { NextFreeLine } from "./NextFreeLine";

// Baan-teaser (#273): enkel de eerstvolgende vrije baan als reminder — het
// volledige rooster woont op de Banen-tab (één tik verder). Houdt zijn eigen
// laad- en foutstaat, los van de kernbronnen van het dashboard.

export function CourtTeaser({
  availability,
  timezone,
}: {
  availability: AsyncState<DayAvailability>;
  timezone: string;
}) {
  const slot = availability.data
    ? nextFreeSlot(availability.data, null, minutesNowInZone(timezone))
    : null;

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Vrije banen vandaag</h2>
        <Link className="profile-link" to="/banen">
          Alle dagen →
        </Link>
      </div>
      {availability.loading ? (
        <Skeleton rows={1} />
      ) : availability.error ? (
        <p className="msg msg--error">{availability.error}</p>
      ) : availability.data ? (
        <NextFreeLine slot={slot} />
      ) : null}
    </section>
  );
}

export default CourtTeaser;
