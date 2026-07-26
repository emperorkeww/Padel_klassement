import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { SwUpdatePrompt } from "./SwUpdatePrompt.tsx";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { ToastProvider } from "@/ui/ToastProvider";
import { SmoesPromptProvider } from "@/features/matches/SmoesPromptProvider";
import { watchSystemTheme } from "@/lib/utils/theme";
import { initInstallPromptCapture } from "@/lib/utils/pwa";
import { registerServiceWorker } from "@/lib/utils/swUpdate";
import "./index.css";

// Het inline script in index.html zette het thema al vóór de eerste paint;
// hier alleen nog OS-wissels blijven volgen zolang de voorkeur "systeem" is.
watchSystemTheme();

// beforeinstallprompt vuurt vlak na page-load — vóór de lazy dashboard-chunk
// geladen is — dus hier eager afvangen; InstallPrompt leest het later uit.
initInstallPromptCapture();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Buitenste vangnet (#733): staat bewust bóven de providers, zodat ook
        een crash in AuthProvider/ToastProvider zelf nog een scherm oplevert
        in plaats van een witte pagina. De fallback gebruikt daarom geen
        context. */}
    <ErrorBoundary scope="root">
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <SwUpdatePrompt />
            <SmoesPromptProvider>
              <App />
            </SmoesPromptProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);

// Service worker voor offline-ondersteuning + update-flow (#463). Alleen in
// productie: in dev zou caching Vite's hot-reload in de weg zitten.
if (import.meta.env.PROD) {
  registerServiceWorker();
}
