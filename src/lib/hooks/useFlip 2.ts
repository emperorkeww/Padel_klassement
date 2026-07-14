import { useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/utils/motion";

/**
 * FLIP-animatie voor lijsten die van volgorde wisselen (klassement bij een
 * nieuwe uitslag): kinderen met een `data-flip-key` glijden naar hun nieuwe
 * plek i.p.v. hard te verspringen.
 *
 * Hang de ref aan de container en geef als `orderKey` een string die de
 * volgorde beschrijft (bv. de rij-keys aaneengeplakt); bij elke wijziging
 * wordt het positieverschil per key geanimeerd.
 */
export function useFlip<T extends HTMLElement>(orderKey: string) {
  const ref = useRef<T | null>(null);
  const positions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;

    const containerTop = container.getBoundingClientRect().top;
    const items = container.querySelectorAll<HTMLElement>("[data-flip-key]");
    const prev = positions.current;
    const next = new Map<string, number>();
    const reduce = prefersReducedMotion();

    for (const el of items) {
      const key = el.dataset.flipKey;
      if (!key) continue;
      // Relatief aan de container, zodat scrollen tussendoor niet meetelt.
      const top = el.getBoundingClientRect().top - containerTop;
      next.set(key, top);

      const old = prev.get(key);
      if (
        !reduce &&
        typeof el.animate === "function" &&
        old != null &&
        Math.abs(old - top) > 1
      ) {
        el.animate(
          [{ transform: `translateY(${old - top}px)` }, { transform: "none" }],
          { duration: 450, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      }
    }
    positions.current = next;
  }, [orderKey]);

  return ref;
}
