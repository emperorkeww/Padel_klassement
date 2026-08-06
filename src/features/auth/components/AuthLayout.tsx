import type { ReactNode } from "react";
import { AuthBrandPanel, type AuthBrandMode } from "./AuthBrandPanel";

export function AuthLayout({
  brandMode,
  children,
}: {
  brandMode: AuthBrandMode;
  children: ReactNode;
}) {
  return (
    <div className={`login login--${brandMode}`}>
      <div className="login-shell">
        <AuthBrandPanel mode={brandMode} />
        {children}
      </div>
    </div>
  );
}

export default AuthLayout;
