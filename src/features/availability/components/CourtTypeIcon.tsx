/* Icoontje voor het baantype: dak = overdekt, zon = buiten.
   Vorm én kleur verschillen, zodat het ook zonder legenda te scannen is. */
export function CourtTypeIcon({ type }: { type: string }) {
  if (type === "roofed") {
    return (
      <svg
        className="court-icon court-icon--roofed"
        width="11"
        height="11"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 8 8 2l6 6" />
        <path d="M4 7v7h8V7" />
      </svg>
    );
  }
  if (type === "outdoor") {
    return (
      <svg
        className="court-icon court-icon--outdoor"
        width="11"
        height="11"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4" />
      </svg>
    );
  }
  return null;
}
