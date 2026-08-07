import { activePolls } from "./pollLogic";
import { shortDay } from "./planPollHelpers";
import type { PlayPoll, PollOption } from "./pollsApi";

// Reis-status van een groep (#106): waar zit deze groep in de kernreis?
// Stond eerst alleen in Groups.tsx voor de badges op de hub; sinds #674 (A3)
// bepaalt dezelfde logica ook waar je landt als je een groep rechtstreeks
// opent — voorheen kwam je altijd op Vandaag, ook op een dag zonder plan.
//
// Sinds #1121 wijst alles wat over plannen gaat naar de agenda: de Plannen-tab
// van de groepspagina bestaat niet meer. Het label is een aansporing ("stem
// mee", "boek de baan"), dus het moet je brengen waar je dat kunt doen.

export type JourneyTab = "agenda" | "vandaag";

export type Journey = {
  /** Decoratief icoon vóór het label; los van de tekst zodat de screenreader
   *  "Poll loopt" hoort en niet "staafdiagram Poll loopt" (#674 B6). */
  icon: string | null;
  label: string;
  /** "act" = actie nodig (accent), "info" = staat vast, "idle" = niets gepland. */
  tone: "act" | "info" | "idle";
  tab: JourneyTab;
};

export function journeyFor(
  polls: PlayPoll[],
  options: PollOption[],
  today: string,
  nowMs: number,
): Journey {
  // Bij meerdere speeldagen (#267) toont de reis-badge de meest dringende:
  // een poll die stemmen/boeken vraagt gaat vóór een al geboekt moment.
  const running = activePolls(polls, options, nowMs);
  const active =
    running.find((p) => p.status === "open" || p.status === "locked") ??
    running[0] ??
    null;
  const locked = active?.locked_option_id
    ? (options.find((o) => o.id === active.locked_option_id) ?? null)
    : null;
  if (active?.status === "open") {
    return {
      icon: "📊",
      label: "Poll loopt — stem mee",
      tone: "act",
      tab: "agenda",
    };
  }
  if (active?.status === "locked" && locked) {
    return {
      icon: "📆",
      label: `${shortDay(locked.date)} gekozen — boek de baan`,
      tone: "act",
      tab: "agenda",
    };
  }
  if (active?.status === "booked" && locked) {
    return {
      icon: "🎾",
      label: `${shortDay(locked.date)} · ${locked.start_time} geboekt`,
      tone: "info",
      tab: locked.date === today ? "vandaag" : "agenda",
    };
  }
  return {
    icon: null,
    label: "Plan een speeldag →",
    tone: "idle",
    tab: "agenda",
  };
}
