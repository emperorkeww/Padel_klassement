import { useEffect, useRef } from "react";

/**
 * Paginabrede tabbalk met échte tab-semantiek (#674 B2): role="tablist" +
 * role="tab" + aria-selected, roving tabindex en pijltjestoets-navigatie.
 * Losse <button>'s met een is-active-class lieten screenreader-gebruikers in
 * het ongewisse over welke tab actief was.
 *
 * De teller zit in de toegankelijke naam ("Leden, 6") in plaats van achter
 * aria-hidden: het aantal is informatie, geen decoratie.
 *
 * Het paneel eromheen krijgt role="tabpanel" (zie TabPanel) — alleen de
 * actieve tab wijst ernaar met aria-controls, want de andere panelen staan
 * niet in de DOM.
 */

export type PageTabItem<K extends string> = {
  id: K;
  label: string;
  /** Optionele teller achter het label; gaat mee in de naam ("Historie, 12"). */
  count?: number;
};

export function PageTabs<K extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  idPrefix,
}: {
  tabs: PageTabItem<K>[];
  value: K;
  onChange: (id: K) => void;
  ariaLabel: string;
  /** Prefix voor de tab-/paneel-id's; moet gelijk zijn aan die van TabPanel.
   *  Laat 'm weg als de tab-inhoud geen aaneengesloten blok is (bv. het
   *  klassement, waar de tabkeuze door de hele pagina heen doorwerkt): dan
   *  blijft `aria-controls` achterwege in plaats van naar een niet-bestaand
   *  paneel te wijzen. */
  idPrefix?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Op smalle schermen scrollt de balk (.tabs--page); zorg dat de actieve tab
  // in beeld staat als je ergens op landt (bv. ?tab=leden).
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    // jsdom kent scrollIntoView niet.
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [value]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex((t) => t.id === value);
    if (i < 0) return;
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    // Focus volgt de selectie (automatische activering): de panelen zijn
    // client-side en meteen klaar, dus een aparte Enter-stap zou alleen kosten.
    const btns = listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    btns?.[next]?.focus();
  }

  return (
    <div
      ref={listRef}
      className="tabs tabs--page"
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${t.id}` : undefined}
            className={`tab ${active ? "is-active" : ""}`}
            aria-selected={active}
            aria-controls={
              idPrefix && active ? `${idPrefix}-panel-${t.id}` : undefined
            }
            aria-label={t.count === undefined ? undefined : `${t.label}, ${t.count}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="tab__count" aria-hidden="true">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Het paneel bij de actieve tab van een PageTabs met dezelfde idPrefix. */
export function TabPanel({
  id,
  idPrefix,
  children,
}: {
  id: string;
  idPrefix: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
    >
      {children}
    </div>
  );
}
