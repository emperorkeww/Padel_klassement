import type { SortKey, SortState } from "../leaderboardHelpers";

/** Klikbare kolomkop met sorteerpijl; hergebruikt de tie-break uit standings.ts. */
export function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  title,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState | null;
  onSort: (key: SortKey) => void;
  title?: string;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th
      className={`num th-sort${className ? ` ${className}` : ""}`}
      aria-sort={
        active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        className="th-sort__btn"
        onClick={() => onSort(sortKey)}
        title={title}
      >
        {label}
        <span
          className={`th-sort__arrow ${active ? "is-active" : ""}`}
          aria-hidden="true"
        >
          {active ? (sort!.dir === "desc" ? "▼" : "▲") : "▾"}
        </span>
      </button>
    </th>
  );
}
