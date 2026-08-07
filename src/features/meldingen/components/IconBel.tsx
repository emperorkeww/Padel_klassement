/** Belletje in line-stijl op currentColor, net als de navigatie-iconen in de
 *  shell (#1090). Eigen bestand omdat zowel de knop in de topbalk als de
 *  zijbalkregel hem gebruikt. */
export function IconBel() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
      <path d="M10.4 18.5a1.9 1.9 0 0 0 3.2 0" />
    </svg>
  );
}

export default IconBel;
