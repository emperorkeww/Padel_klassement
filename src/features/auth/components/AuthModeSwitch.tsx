import type { KeyboardEvent } from "react";

export type AuthFormMode = "signin" | "signup";

const MODES: Array<{ mode: AuthFormMode; label: string }> = [
  { mode: "signin", label: "Inloggen" },
  { mode: "signup", label: "Registreren" },
];

export function AuthModeSwitch({
  active,
  onChange,
  panelId,
}: {
  active: AuthFormMode;
  onChange: (mode: AuthFormMode) => void;
  panelId: string;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const next =
      event.key === "ArrowLeft" || event.key === "Home" ? "signin" : "signup";
    onChange(next);
    document.getElementById(`auth-tab-${next}`)?.focus();
  }

  return (
    <div
      className="login-tabs"
      role="tablist"
      aria-label="Inloggen of registreren"
    >
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          id={`auth-tab-${mode}`}
          role="tab"
          aria-selected={active === mode}
          aria-controls={panelId}
          tabIndex={active === mode ? 0 : -1}
          className={`login-tab ${active === mode ? "is-active" : ""}`}
          onClick={() => onChange(mode)}
          onKeyDown={handleKeyDown}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default AuthModeSwitch;
