import "./CoachAvatar.css";

// Het vaste gezicht van Coach Rudy (#211): een handgetekende inline-SVG-mascotte
// — pet, blik en fluitje — in de warme --coach-accentkleur. Eén component voor
// élk coach-oppervlak (feed-bubble, profiel, kennismaking, dashboard, …), zodat
// hij overal hetzelfde herkenbare koppie heeft. Inline SVG = schaalt scherp,
// geen externe asset (CSP-/offline-proof).
export function CoachAvatar({
  size = 28,
  className,
}: {
  /** Diameter in px. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`coach-avatar${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        role="img"
        aria-label="Coach Rudy"
      >
        {/* Ronde badge */}
        <circle cx="20" cy="20" r="19" fill="var(--coach-soft)" stroke="var(--coach-line)" strokeWidth="1.2" />
        {/* Gezicht */}
        <circle cx="20" cy="23" r="10.5" fill="#ffe4c9" stroke="var(--coach)" strokeWidth="1" />
        {/* Pet: koepel + klep + knopje */}
        <path d="M10 21 A10 10 0 0 1 30 21 Z" fill="var(--coach)" />
        <rect x="3.5" y="20.2" width="15" height="2.8" rx="1.4" fill="var(--coach)" />
        <circle cx="20" cy="11.6" r="1" fill="var(--coach-ink)" />
        {/* Ogen + zelfverzekerde smirk */}
        <circle cx="16.5" cy="24" r="1.3" fill="var(--coach-ink)" />
        <circle cx="23.5" cy="24" r="1.3" fill="var(--coach-ink)" />
        <path
          d="M16.5 28 Q20 30.2 23.5 28"
          fill="none"
          stroke="var(--coach-ink)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {/* Fluitje */}
        <rect x="23" y="30.5" width="6" height="3.2" rx="1.6" fill="var(--coach)" />
        <circle cx="28.2" cy="32.1" r="0.9" fill="var(--coach-ink)" />
      </svg>
    </span>
  );
}

export default CoachAvatar;
