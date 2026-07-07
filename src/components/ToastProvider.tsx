import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import "./Toast.css";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; type: ToastType; text: string };

type ToastApi = {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
};

const ToastContext = createContext<ToastApi | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );

  const push = useCallback(
    (type: ToastType, text: string) => {
      const id = ++counter;
      setToasts((t) => [...t, { id, type, text }]);
      // Fouten blijven staan tot ze weggeklikt worden (assertief aangekondigd);
      // succes/info verdwijnen vanzelf.
      if (type !== "error") setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t) => push("success", t),
      error: (t) => push("error", t),
      info: (t) => push("info", t),
    }),
    [push],
  );

  const errors = toasts.filter((t) => t.type === "error");
  const polite = toasts.filter((t) => t.type !== "error");

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts">
        {/* Succes/info: rustig aangekondigd (polite). */}
        <div className="toasts__live" role="status" aria-live="polite">
          {polite.map((t) => (
            <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
          ))}
        </div>
        {/* Fouten: direct aangekondigd (assertive) en blijven staan. */}
        <div className="toasts__live" role="alert" aria-live="assertive">
          {errors.map((t) => (
            <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div className={`toast toast--${toast.type}`}>
      <span className="toast__text">{toast.text}</span>
      <button
        type="button"
        className="toast__close"
        aria-label="Sluiten"
        onClick={onClose}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast moet binnen <ToastProvider> gebruikt worden");
  return ctx;
}
