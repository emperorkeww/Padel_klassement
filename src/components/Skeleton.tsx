import "./Skeleton.css";

/** Eenvoudige laad-placeholder (shimmer). */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton__row" />
      ))}
    </div>
  );
}

export default Skeleton;
