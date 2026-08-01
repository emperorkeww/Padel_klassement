import type { CSSProperties } from "react";
import { Avatar, type AvatarSource } from "@/ui/Avatar";
import { MAX_MEMBER_AVATARS } from "../groepHelpers";
import "./MemberStack.css";

/* ------------------------------------------------------------------ */
/* Overlappende rij lid-avatars met een "+n"-badge voor de rest.       */
/*                                                                     */
/* Stond drie keer los in de code — hub (Groups), groepskop            */
/* (GroupDetail) en uitnodiging (JoinGroup) — en liep uit elkaar: de   */
/* hub en de uitnodiging tekenden het restaantal als badge, de         */
/* groepskop als kaal getal dat óók nog onder de laatste avatar schoof */
/* (#975; #946 probeerde dat al te repareren, maar die marge verloor   */
/* van de stapel-overlap op specificiteit). Eén component, dus dat kan */
/* niet meer uiteenlopen.                                              */
/*                                                                     */
/* De stapel is decoratief: het ledental staat er in tekst naast, dus  */
/* een screenreader hoeft hier geen rij lege plaatjes te horen.        */
/* ------------------------------------------------------------------ */

export function MemberStack({
  ids,
  profiles,
  size = 20,
  total,
}: {
  /** Lid-id's; alleen de eerste MAX_MEMBER_AVATARS krijgen een avatar. */
  ids: string[];
  profiles: Record<string, AvatarSource | undefined>;
  /** Diameter van één avatar (en van de badge). */
  size?: number;
  /** Het échte ledental als dat groter is dan `ids` — de uitnodigingspagina
   *  krijgt een preview met een los geteld aantal. */
  total?: number;
}) {
  if (ids.length === 0) return null;

  const rest = (total ?? ids.length) - MAX_MEMBER_AVATARS;

  return (
    <span
      className="member-stack"
      aria-hidden="true"
      style={{ "--stack-size": `${size}px` } as CSSProperties}
    >
      {ids.slice(0, MAX_MEMBER_AVATARS).map((id) => (
        <Avatar key={id} profile={profiles[id]} size={size} short />
      ))}
      {rest > 0 && <span className="member-stack__meer">+{rest}</span>}
    </span>
  );
}

export default MemberStack;
