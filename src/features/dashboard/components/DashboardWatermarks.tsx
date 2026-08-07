/**
 * Gedeelde padelwatermerken voor het overzicht (#1120).
 *
 * Dit zijn bewust lichte inline-SVG's: geen extra request, geen rasterasset en
 * scherp op elk scherm. Ze dragen geen informatie — tekst, CTA's en statussen
 * blijven de volledige toegankelijke inhoud van hun kaart.
 */

const perforaties = [-32, -16, 0, 16, 32].flatMap((x) =>
  [-42, -21, 0, 21, 42].map((y) => ({ x, y })),
);

export function HeroCourtWatermark() {
  return (
    <svg
      className="hero__court-watermark"
      viewBox="0 0 560 280"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <path className="court-watermark__arc" d="M72 242C174 74 360 12 526 56" />
      <path className="court-watermark__court-line" d="M180 266 530 266M454 266 534 184" />
      <g className="court-watermark__racket" transform="rotate(-18 382 124)">
        <ellipse cx="382" cy="108" rx="76" ry="90" />
        <ellipse cx="382" cy="108" rx="63" ry="77" />
        <g className="court-watermark__perforations" transform="translate(382 108)">
          {perforaties.map((p) => (
            <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r="3.2" />
          ))}
        </g>
        <path className="court-watermark__throat" d="M350 181 328 215M414 181 386 215" />
        <path className="court-watermark__handle" d="M357 204 301 276" />
        <path className="court-watermark__grip" d="m337 229-19-15m7 30-18-14m7 29-17-13" />
      </g>
      <g className="court-watermark__ball">
        <circle cx="492" cy="210" r="29" />
        <path d="M468 194c17 5 29 17 38 37M478 184c-2 17 5 31 22 44" />
      </g>
    </svg>
  );
}

function Player({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g
      className="poll-watermark__player"
      transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}
    >
      <circle cx="0" cy="-34" r="8" />
      <path d="M-2-24 5 3l-15 27M4-5l22-13M2 3l19 28" />
      <path className="poll-watermark__racket" d="M25-18 40-28m-1-1c8-10 22 1 15 12-7 10-22-1-15-12Z" />
    </g>
  );
}

export function PollCourtWatermark() {
  return (
    <svg
      className="poll-banner__watermark"
      viewBox="0 0 460 180"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <path className="poll-watermark__wash" d="M36 162 138 36h208l98 126Z" />
      <path className="poll-watermark__line" d="M36 162 138 36h208l98 126ZM112 162l70-126m166 126L302 36M78 108h332M230 36v126" />
      <path className="poll-watermark__net" d="M69 110h342M74 116h332" />
      <Player x={188} y={115} />
      <Player x={326} y={110} flip />
    </svg>
  );
}
