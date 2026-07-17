// Druppel-flits voor de Sproeier-Modus (#262): fullscreen canvas-overlay naar
// het patroon van confetti.ts. Blauwe druppels sproeien vanaf boven het scherm
// naar beneden; vaste felblauwe tinten (geen thema-tokens) zodat de bui in
// licht én donker zichtbaar is. Respecteert prefers-reduced-motion.
import { prefersReducedMotion } from "@/lib/utils/motion";

const DRUPPEL_KLEUREN = ["#60a5fa", "#3b82f6", "#93c5fd", "#38bdf8"];

const COUNT = 70;
const DURATION = 1600; // ms

type Druppel = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lengte: number;
  kleur: string;
};

export function sproei() {
  if (prefersReducedMotion()) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;z-index:100;pointer-events:none;";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const w = window.innerWidth;
  const h = window.innerHeight;
  // Sproeikoppen links en rechts bovenaan, stralen schuin het scherm in.
  const druppels: Druppel[] = Array.from({ length: COUNT }, (_, i) => {
    const links = i % 2 === 0;
    return {
      x: links ? -10 : w + 10,
      y: Math.random() * h * 0.3,
      vx: (links ? 1 : -1) * (4 + Math.random() * 7),
      vy: 1 + Math.random() * 4,
      lengte: 8 + Math.random() * 10,
      kleur: DRUPPEL_KLEUREN[i % DRUPPEL_KLEUREN.length],
    };
  });

  const start = performance.now();
  const tick = (t: number) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, w, h);
    const fade = 1 - Math.max(0, (elapsed - DURATION * 0.6) / (DURATION * 0.4));
    for (const d of druppels) {
      d.vy += 0.3; // zwaartekracht buigt de straal af
      d.x += d.vx;
      d.y += d.vy;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade) * 0.85;
      ctx.strokeStyle = d.kleur;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      // Streepje in de bewegingsrichting: leest als een vallende druppel.
      const snelheid = Math.hypot(d.vx, d.vy) || 1;
      ctx.lineTo(d.x - (d.vx / snelheid) * d.lengte, d.y - (d.vy / snelheid) * d.lengte);
      ctx.stroke();
      ctx.restore();
    }
    if (elapsed < DURATION) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}
