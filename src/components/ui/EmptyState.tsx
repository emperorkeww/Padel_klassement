import type { ReactNode } from "react";
import "./EmptyState.css";

/**
 * Vriendelijke lege staat: icoon, korte titel, één zin uitleg en optioneel
 * een vervolgactie (Link of button). Voor kleine inline-gevallen (zoals
 * tabelcellen) blijft de bestaande .empty-klasse bestaan.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-state__title">{title}</p>
      {children && <p className="empty-state__text">{children}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
