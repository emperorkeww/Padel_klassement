import { useSyncExternalStore } from "react";
import {
  getInstallPromptEvent,
  isIos,
  isStandalone,
  subscribeInstallPrompt,
} from "@/lib/utils/pwa";
import { readFlag } from "./flags";

/** Het openstaande beforeinstallprompt-event, reactief. main.tsx vangt het
 *  eager af (het vuurt vóór de lazy dashboard-chunk laadt); hier lezen we het
 *  uit. */
export function useInstallPromptEvent() {
  return useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptEvent,
    () => null,
  );
}

/**
 * Zou de installatie-uitnodiging nú iets tonen? (#911)
 *
 * Deze regel zat alleen ín InstallPrompt, waardoor de prompt-gate op het
 * overzicht niet kon weten of er al een onderbreking op het scherm stond — en
 * install en push dus tegelijk konden verschijnen. Hij woont hier los van beide
 * componenten, zodat de gate en de prompt zelf dezelfde regel lezen.
 */
export function useInstallPromptZichtbaar() {
  const promptEvent = useInstallPromptEvent();
  return (
    !readFlag("install-prompt-dismissed") &&
    !isStandalone() &&
    (isIos() || !!promptEvent)
  );
}
