// Gedeeld padelbal-logo (inline SVG). Kleuren uit de huisstijl-tokens
// (var(--lime) / var(--surface)); `color` overschrijft de balkleur desgewenst.
export function BallIcon({
  size = 22,
  color = "var(--lime)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={color} />
      <path
        d="M4 8.5c4 1.5 12 1.5 16 0M4 15.5c4-1.5 12-1.5 16 0"
        stroke="var(--surface)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default BallIcon;
