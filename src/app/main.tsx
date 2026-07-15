import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";
import { SmoesPromptProvider } from "@/features/matches/SmoesPromptProvider";
import { watchSystemTheme } from "@/lib/utils/theme";
import "./index.css";

// Het inline script in index.html zette het thema al vóór de eerste paint;
// hier alleen nog OS-wissels blijven volgen zolang de voorkeur "systeem" is.
watchSystemTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SmoesPromptProvider>
            <App />
          </SmoesPromptProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Service worker voor offline-ondersteuning. Alleen in productie: in dev zou
// caching Vite's hot-reload in de weg zitten.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch(() => {
        /* offline-ondersteuning is optioneel; registratiefouten negeren */
      });
  });
}
