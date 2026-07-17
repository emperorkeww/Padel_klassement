import { useEffect, useRef, useState, type PointerEvent } from "react";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import { playSfx, startPen, type PenHandle } from "@/lib/utils/sfx";
import { wildheid } from "../wildheid";

// Teken je eigen Tactiek (#263): een kladblok waarop je vrij lijnen trekt
// (pointer events dekken muis, touch en pen in één API). Hoe wilder je tekent,
// hoe harder en hoger het pen-gekrabbel (startPen + wildheid-mapping). Na de
// eerste lijn geeft Rudy — na een korte denkpauze — zijn professionele oordeel.

type Punt = { x: number; y: number };

const OPMERKING = "Briljant. Dit sturen we direct naar de KBVB.";
const INKT_DIKTE = 2.2;

export function TactiekCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokes = useRef<Punt[][]>([]);
  const pen = useRef<PenHandle | null>(null);
  const wild = useRef(0);
  const vorige = useRef<(Punt & { t: number }) | null>(null);
  const bezig = useRef(false);
  const opmerkTimer = useRef<number | undefined>(undefined);
  const [opmerking, setOpmerking] = useState(false);

  // Canvas op containerbreedte × dpr houden (cap 2, zoals confetti.ts) en bij
  // resize de bewaarde strokes opnieuw tekenen.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pasAan = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      tekenAlles(ctx, canvas);
    };
    const tekenAlles = (ctx: CanvasRenderingContext2D, el: HTMLCanvasElement) => {
      ctx.strokeStyle = inkt(el);
      ctx.lineWidth = INKT_DIKTE;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const stroke of strokes.current) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (const p of stroke.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    };
    pasAan();
    const observer = new ResizeObserver(pasAan);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Bij unmount: pen nooit laten doorzoemen, denkpauze-timer opruimen.
  useEffect(
    () => () => {
      pen.current?.stop();
      window.clearTimeout(opmerkTimer.current);
    },
    [],
  );

  // Inktkleur volgt het papier-token van het thema.
  const inkt = (el: HTMLElement) =>
    getComputedStyle(el).getPropertyValue("--papier-inkt").trim() || "#2a3550";

  const punt = (e: PointerEvent<HTMLCanvasElement>): Punt => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    bezig.current = true;
    const p = punt(e);
    strokes.current.push([p]);
    vorige.current = { ...p, t: performance.now() };
    wild.current = 0;
    pen.current = startPen();
  };

  const beweeg = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!bezig.current || !vorige.current) return;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = punt(e);
    const nu = performance.now();
    const afstand = Math.hypot(p.x - vorige.current.x, p.y - vorige.current.y);
    wild.current = wildheid(afstand, nu - vorige.current.t, wild.current);
    pen.current?.setIntensiteit(wild.current);

    ctx.strokeStyle = inkt(canvas);
    // Iets dikkere lijn bij wilder tekenen: leest als hardere pendruk.
    ctx.lineWidth = INKT_DIKTE + wild.current * 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(vorige.current.x, vorige.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    strokes.current[strokes.current.length - 1].push(p);
    vorige.current = { ...p, t: nu };
  };

  const stopStroke = () => {
    if (!bezig.current) return;
    bezig.current = false;
    vorige.current = null;
    pen.current?.stop();
    pen.current = null;
    // Rudy's oordeel, éénmalig per tekening, na een korte denkpauze.
    if (!opmerking) {
      window.clearTimeout(opmerkTimer.current);
      opmerkTimer.current = window.setTimeout(() => setOpmerking(true), 800);
    }
  };

  const wis = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    strokes.current = [];
    window.clearTimeout(opmerkTimer.current);
    setOpmerking(false);
    playSfx("page"); // blaadje eruit gescheurd
  };

  return (
    <section className="klikker-categorie tactiek">
      <h2 className="klikker-categorie__titel">
        <span aria-hidden="true">✏️</span> Teken je eigen Tactiek
      </h2>
      <p className="tactiek__uitleg">
        Pak Rudy's kladblok en teken je masterplan. Pijltjes, cirkels, complete
        chaos — hoe wilder de lijnen, hoe harder de pen krast.
      </p>
      <canvas
        ref={canvasRef}
        className="tactiek__canvas"
        aria-label="Kladblok om je eigen tactiek te tekenen"
        onPointerDown={start}
        onPointerMove={beweeg}
        onPointerUp={stopStroke}
        onPointerCancel={stopStroke}
      />
      <div className="tactiek__voet">
        <button type="button" className="btn btn--sm" onClick={wis}>
          Blaadje eruit scheuren
        </button>
      </div>
      <div className="tactiek__oordeel" aria-live="polite">
        {opmerking && (
          <CoachBubble mood="trots">
            <span className="coach-sneer__text">{OPMERKING}</span>
          </CoachBubble>
        )}
      </div>
    </section>
  );
}

export default TactiekCanvas;
