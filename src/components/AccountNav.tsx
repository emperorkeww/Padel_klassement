import { NavLink } from "react-router-dom";

/** Segment-navigatie tussen Profiel en Vrienden — samen het "account"-gebied.
 *  Op mobiel zijn deze pagina's bereikbaar via de avatar in de topbalk. */
export function AccountNav() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `tab ${isActive ? "is-active" : ""}`;
  return (
    <nav className="tabs" aria-label="Account">
      <NavLink to="/profiel" className={cls} viewTransition>
        Profiel
      </NavLink>
      <NavLink to="/vrienden" className={cls} viewTransition>
        Vrienden
      </NavLink>
    </nav>
  );
}

export default AccountNav;
