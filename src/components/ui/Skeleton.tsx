import "./Skeleton.css";

/** Eenvoudige laad-placeholder (shimmer) — generieke regels. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sk sk--row" />
      ))}
    </div>
  );
}

/* ---- Bouwstenen ---- */

function Circle({ size = 32 }: { size?: number }) {
  return <span className="sk sk--circle" style={{ width: size, height: size }} />;
}

function Line({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="sk sk--line" style={{ width: w, height: h }} />;
}

/* ---- Composities die de echte pagina naspelen ----
   Laden voelt korter als de placeholder al de vorm van de inhoud heeft. */

/** Eén matchkaart: avatar-paren + namen links/rechts, scorepil in het midden. */
export function MatchCardSkeleton() {
  return (
    <div className="sk-matchcard" aria-hidden="true">
      <span className="sk-matchcard__side">
        <Circle size={26} />
        <Circle size={26} />
        <span className="sk-matchcard__names">
          <Line w="80%" h={11} />
          <Line w="65%" h={11} />
        </span>
      </span>
      <span className="sk sk--pill" />
      <span className="sk-matchcard__side sk-matchcard__side--right">
        <span className="sk-matchcard__names">
          <Line w="80%" h={11} />
          <Line w="65%" h={11} />
        </span>
        <Circle size={26} />
        <Circle size={26} />
      </span>
    </div>
  );
}

export function MatchListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Feed-tijdlijn: dag-lijntje met daaronder een matchkaart en lichte regels. */
export function FeedSkeleton() {
  return (
    <div className="skeleton sk-feed" aria-hidden="true">
      <Line w={90} h={11} />
      <MatchCardSkeleton />
      <span className="sk-feed__line">
        <Circle size={28} />
        <Line w="70%" h={12} />
      </span>
      <span className="sk-feed__line">
        <Circle size={28} />
        <Line w="55%" h={12} />
      </span>
      <Line w={90} h={11} />
      <MatchCardSkeleton />
    </div>
  );
}

/** Klassementsrijen: rang, avatar, naam en punten rechts. */
export function StandingsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sk-standing">
          <span className="sk sk--rank" />
          <Circle size={30} />
          <Line w={`${62 - (i % 3) * 8}%`} />
          <span className="sk sk--points" />
        </div>
      ))}
    </div>
  );
}

/** Profielkop: grote avatar met naam en subregel. */
export function ProfileSkeleton() {
  return (
    <div className="sk-profile" aria-hidden="true">
      <Circle size={72} />
      <span className="sk-profile__text">
        <Line w="55%" h={20} />
        <Line w="35%" h={12} />
      </span>
    </div>
  );
}

/** Statblokken naast elkaar (zoals .stats). Vier op het profiel; het
 *  overzicht telt er sinds #1242 drie en geeft dat mee. */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="sk-stats" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="sk sk--stat" />
      ))}
    </div>
  );
}

/** Eén groepskaart op de Spelen-hub: avatar met naam, de ledenrij en de
 *  statusregel (#949, hervormd in #1134).
 *
 *  Was een stapel van `count` kaarten in een eigen grid; sinds #1134 staan de
 *  groepen in een horizontale rij die zijn eigen breedtes bepaalt, dus levert
 *  dit blad één kaart en herhaalt de rij hem. De maten volgen de echte kaart:
 *  een skeleton die kleiner is dan wat erop volgt, verplaatst de pagina alsnog. */
export function GroupCardSkeleton() {
  return (
    <div className="skeleton sk-group" aria-hidden="true">
      <span className="sk-group__kop">
        <Circle size={40} />
        <Line w="55%" h={16} />
      </span>
      <span className="sk-group__leden">
        <Circle size={20} />
        <Circle size={20} />
        <Circle size={20} />
        <Line w="30%" h={11} />
      </span>
      <Line w="45%" h={11} />
    </div>
  );
}

/** Uitnodigingskaart (#923): uitnodiger-regel, groepsnaam, ledenrij en de
 *  bevestigknop — de vorm van de kaart die je zo te zien krijgt. */
export function InviteSkeleton() {
  return (
    <div className="skeleton sk-invite" aria-hidden="true">
      <Line w="45%" h={11} />
      <Line w="65%" h={22} />
      <span className="sk-invite__leden">
        <Circle size={28} />
        <Circle size={28} />
        <Circle size={28} />
        <Line w="22%" h={12} />
      </span>
      <span className="sk sk--knop" />
    </div>
  );
}

/** Speeldag-poll: de fasebalk boven een paar stemrijen met knoppen rechts. */
export function PollSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      <Line w="70%" h={14} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sk-poll-row">
          <Line w={`${45 - (i % 2) * 10}%`} h={13} />
          <span className="sk sk--pill sk-poll-row__seg" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
