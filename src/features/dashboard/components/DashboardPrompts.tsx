import { useInstallPromptZichtbaar } from "../installPrompt";
import { InstallPrompt } from "./InstallPrompt";
import { PushPrompt } from "./PushPrompt";

/**
 * Hooguit één onderbreking per bezoek (#911).
 *
 * De install- en push-uitnodiging stonden direct na elkaar op het overzicht,
 * elk met hun eigen zichtbaarheidsregels en zonder onderlinge volgorde. In het
 * slechtste geval kreeg een nieuwe gebruiker twee kaarten met een vraag onder
 * elkaar, boven de banen-teaser.
 *
 * Installeren wint: op iOS werken meldingen pas ná installatie, dus daar is de
 * installatie letterlijk de voorwaarde voor push. Dezelfde volgorde op alle
 * platforms houdt het voorspelbaar. Kan de installatie-prompt niets tonen, dan
 * krijgt push de beurt — en die beslist nog zelf of hij iets te vragen heeft.
 */
export function DashboardPrompts({ userId }: { userId: string }) {
  const installEerst = useInstallPromptZichtbaar();
  return installEerst ? <InstallPrompt /> : <PushPrompt userId={userId} />;
}

export default DashboardPrompts;
