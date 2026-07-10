// Korte confetti-burst bij een gewonnen match — canvas-overlay, geen
// dependency. Kleuren uit de huisstijl; respecteert prefers-reduced-motion.
import { prefersReducedMotion } from "./motion";

// Vaste, felle huisstijlkleuren (het lichte palet). Bewust NIET de live
// CSS-tokens: in dark mode zijn die gedempt en valt confetti weg tegen de
// donkere achtergrond — feest hoort fel te zijn in beide thema's (#125).
const CONFETTI_COLORS = [
  "#0c8a5f",
  "#c7e63a",
  "#16a34a",
  "#d4a017",
  "#93b515",
  "#e6f5ee",
];

function paletteColors(): string[] {
  return CONFETTI_COLORS;
}

const COUNT = 90;
const DURATION = 1400; // ms

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  color: string;
};

export function celebrate() {
  if (prefersReducedMotion()) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;z-index:100;pointer-events:none;";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const w = window.innerWidth;
  const h = window.innerHeight;
  const colors = paletteColors();
  // Burst vanuit het onderste midden, omhoog uitwaaierend.
  const particles: Particle[] = Array.from({ length: COUNT }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const speed = 9 + Math.random() * 9;
    return {
      x: w / 2 + (Math.random() - 0.5) * 80,
      y: h * 0.75,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.4,
      color: colors[i % colors.length],
    };
  });

  const start = performance.now();
  const tick = (t: number) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, w, h);
    const fade = 1 - Math.max(0, (elapsed - DURATION * 0.6) / (DURATION * 0.4));
    for (const p of particles) {
      p.vy += 0.35; // zwaartekracht
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (elapsed < DURATION) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}
