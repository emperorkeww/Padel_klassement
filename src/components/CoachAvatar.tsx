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
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label="Coach Rudy"
      >
        {/* Background Circle */}
        <circle cx="50" cy="50" r="48" fill="var(--coach-soft)" stroke="var(--coach-line)" strokeWidth="1.2"/>
        
        {/* Suit (Navy Blue / coach color) */}
        <path d="M25 85 L25 100 L75 100 L75 85 L68 75 L32 75 Z" fill="var(--coach)" />
        
        {/* White Shirt V-neck */}
        <path d="M42 75 L50 90 L58 75 Z" fill="#ffffff" />
        
        {/* Red Tie */}
        <path d="M48 83 L52 83 L54 98 L50 102 L46 98 Z" fill="#ef4444" stroke="var(--coach-line)" strokeWidth="0.5" />
        
        {/* Head & Neck */}
        <path d="M44 65 L44 78 L56 78 L56 65 Z" fill="#ffe4c9" /> {/* Neck */}
        <ellipse cx="50" cy="50" rx="16" ry="18" fill="#ffe4c9" stroke="var(--coach)" strokeWidth="1" /> {/* Face */}
        
        {/* Eyes */}
        <circle cx="44" cy="48" r="1.5" fill="var(--coach-ink)" />
        <circle cx="56" cy="48" r="1.5" fill="var(--coach-ink)" />
        
        {/* Eyebrows (Slightly worried/concentrated) */}
        <path d="M39 44 Q44 42 47 45" stroke="var(--coach-ink)" strokeWidth="1.5" fill="none" />
        <path d="M61 44 Q56 42 53 45" stroke="var(--coach-ink)" strokeWidth="1.5" fill="none" />
        
        {/* Nose (French/slender) */}
        <path d="M50 46 L49 53 L52 53" stroke="var(--coach-ink)" strokeWidth="1" fill="none" />
        
        {/* Mouth (Smirk or slightly annoyed look) */}
        <path d="M45 58 Q50 62 55 58" stroke="var(--coach-ink)" strokeWidth="1.5" fill="none" />
        
        {/* Hair (Slicked back under cap) */}
        <path d="M34 50 Q31 52 31 56 Q33 60 34 58 Z" fill="var(--coach-ink)" />
        <path d="M66 50 Q69 52 69 56 Q67 60 66 58 Z" fill="var(--coach-ink)" />
        
        {/* Sporty Cap (Black with Belgian Flag detail) */}
        <path d="M33 42 C33 26 67 26 67 42 Z" fill="#0f172a" /> {/* Cap dome */}
        <path d="M31 41 Q50 35 69 41 L73 45 Q50 41 27 45 Z" fill="#334155" /> {/* Cap brim */}
        
        {/* Belgian flag stripes on the cap */}
        <rect x="44" y="30" width="4" height="6" fill="#000000" />
        <rect x="48" y="30" width="4" height="6" fill="#facc15" />
        <rect x="52" y="30" width="4" height="6" fill="#ef4444" />
        
        {/* Sprinkler Water Drops (Soaked look!) */}
        <circle cx="28" cy="38" r="1.5" fill="#38bdf8" opacity="0.8" />
        <circle cx="72" cy="48" r="1" fill="#38bdf8" opacity="0.8" />
        <circle cx="50" cy="22" r="1.2" fill="#38bdf8" opacity="0.8" />
        <circle cx="62" cy="78" r="1" fill="#38bdf8" opacity="0.8" />
        <circle cx="38" cy="85" r="1.5" fill="#38bdf8" opacity="0.8" />
      </svg>
    </span>
  );
}

export default CoachAvatar;
