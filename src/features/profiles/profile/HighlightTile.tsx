// Eén highlight als tegel: consistent icoon + kort label + waarde (+ optionele
// meta), in dezelfde taal als de Stat- en .h2h-highlight-tegels. Gedeeld door
// de Overzicht-highlights en de Trends-weetjes zodat beide er identiek uitzien.
export function HighlightTile({
  icon,
  label,
  value,
  meta,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="highlight-tile">
      <span className="highlight-tile__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="highlight-tile__body">
        <span className="highlight-tile__label">{label}</span>
        <span className="highlight-tile__value">{value}</span>
        {meta != null && <span className="highlight-tile__meta">{meta}</span>}
      </div>
    </div>
  );
}

export default HighlightTile;
