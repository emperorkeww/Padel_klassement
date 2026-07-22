import { useState, type ReactNode } from "react";
import { Avatar } from "@/ui/Avatar";
import { AvatarLightbox } from "@/features/profiles/components/AvatarLightbox";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import { displayName } from "@/features/profiles/api";
import { withViewTransition } from "@/lib/utils/motion";
import { outcomeFor } from "@/features/rating/results";
import { tierForWeergave } from "@/features/rating/tiers";
import { FormChips } from "@/features/rating/components/FormChips";
import {
  FutKaart,
  FutKaartDefs,
  FutKaartVoorkant,
} from "@/features/rating/components/FutKaart";
import type { ProfileData } from "@/features/profiles/components/types";

// Kop boven de tabs (#496): de speler als grote interactieve FUT-kaart
// (zelfde recept als de Opstelling, #495) met de identiteit ernaast — naam
// (+ "jij"/streak/Big Daddy), @handle en Rudy's doopbubbel. Tik op de kaart
// en hij draait om (3D-flip) naar vorm, balans, klassement, beste rating en
// de tier-voortgang; alles komt kant-en-klaar uit ProfileData. Een tik op de
// avatar zélf blijft de foto vergroten (#572) — die knop ligt bóven de
// flip-overlay. `action` is een optionele knop bij de identiteit (bv. een
// vriendverzoek op andermans profiel, #282).
export function ProfileHero({ d, action }: { d: ProfileData; action?: ReactNode }) {
  const { p, isMe, streak, nick, roast, rank } = d;
  // Bijnaam als door Coach Rudy uitgedeeld (#298): i.p.v. een kale regel deelt
  // hij de doopnaam zélf uit, in dezelfde bubbel als zijn eventuele oordeel.
  // Op je eigen profiel spreekt hij je aan met "je", elders noemt hij de naam.
  // Bij een roast-schild is `roast` null en `nick` neutraal (#183): dan blijft
  // enkel de rustige doopregel over, zonder plaag.
  const aanhef = isMe ? "je" : displayName(p);
  const naam = displayName(p);
  // Weergave-tier (#545): buiten De Troon draagt niemand de dictator-special.
  const tier = tierForWeergave(d.myRating ?? null, d.isDictator ?? false);
  const [omgedraaid, setOmgedraaid] = useState(false);
  const draai = () => setOmgedraaid((v) => !v);
  // De avatar is alleen zinvol klikbaar wanneer er echt een foto is; bij een
  // initialen-avatar blijft het de kale (decoratieve) span (#572).
  const photoUrl = p.avatar_url ?? null;
  const [zoomed, setZoomed] = useState(false);
  return (
    <section className="card profile-hero">
      <FutKaartDefs />
      <div className="profile-hero__kaart">
        <FutKaart
          tier={tier}
          omgedraaid={omgedraaid}
          voorOverlay={
            <button
              type="button"
              className="fut-kaart__flip"
              onClick={draai}
              aria-expanded={omgedraaid}
              aria-label={`Statistieken van ${naam}`}
            />
          }
          voor={
            <FutKaartVoorkant
              elo={d.myRating ?? null}
              tier={tier}
              naam={naam}
              avatar={<KaartAvatar d={d} zoomed={zoomed} onZoom={setZoomed} />}
            />
          }
          achterOverlay={
            <button
              type="button"
              className="fut-kaart__flip"
              onClick={draai}
              tabIndex={omgedraaid ? 0 : -1}
              aria-label="Draai de kaart terug"
            />
          }
          achter={<KaartStats d={d} />}
        />
        <span className="profile-hero__fliphint" aria-hidden="true">
          Tik op de kaart voor statistieken
        </span>
      </div>
      {photoUrl && (
        <AvatarLightbox
          open={zoomed}
          onClose={() => withViewTransition(() => setZoomed(false))}
          url={photoUrl}
          name={naam}
        />
      )}
      <div className="profile-hero__body">
        <h1 className="profile-hero__name">
          {naam}
          {rank === 1 && (
            <span className="badge badge--bigdaddy">👑 Big Daddy</span>
          )}
          {isMe && <span className="badge badge--accent">jij</span>}
          {streak >= 2 && (
            <span className="badge badge--win">{streak} op rij 🔥</span>
          )}
        </h1>
        <p className="profile-hero__handle">@{p.username}</p>
        {action && <div className="profile-hero__action">{action}</div>}
        <div className="profile-hero__coach" role="note">
          <CoachBubble mood="portret" size={31}>
            <span className="coach-sneer__text">
              Ik doop {aanhef}:{" "}
              <strong className="profile-hero__dub-name">{nick}</strong>
            </span>
            {roast && <span className="coach-sneer__text">{roast}</span>}
          </CoachBubble>
        </div>
      </div>
    </section>
  );
}

/** Avatar op het kaartvlak: mét foto een lightbox-knop (#572) die bóven de
 *  flip-overlay ligt ("avatar = zoomen, rest van de kaart = draaien"); zonder
 *  foto de kale initialen-span. De view-transition-naam wisselt naar "none"
 *  zodra de lightbox open staat, zodat nooit twee elementen tegelijk
 *  "player-avatar" heten. */
function KaartAvatar({
  d,
  zoomed,
  onZoom,
}: {
  d: ProfileData;
  zoomed: boolean;
  onZoom: (v: boolean) => void;
}) {
  const photoUrl = d.p.avatar_url ?? null;
  if (!photoUrl) {
    return (
      <span
        style={{ viewTransitionName: "player-avatar", display: "inline-flex" }}
      >
        <Avatar profile={d.p} size={76} />
      </span>
    );
  }
  return (
    <button
      type="button"
      className="profile-hero__avatar-btn"
      style={{
        viewTransitionName: zoomed ? "none" : "player-avatar",
        display: "inline-flex",
      }}
      aria-label="Profielfoto vergroten"
      onClick={() => withViewTransition(() => onZoom(true))}
    >
      <Avatar profile={d.p} size={76} />
    </button>
  );
}

/** Achterkant van de hero-kaart: vorm, balans (over de seizoens-matches),
 *  klassement, beste rating en de voortgang naar de volgende divisie. Alle
 *  velden defensief gelezen — de kaart is puur presentatie en moet ook met
 *  een halfgevulde ProfileData (tests, ladende pagina) overeind blijven. */
function KaartStats({ d }: { d: ProfileData }) {
  const form = d.form ?? [];
  const ms = d.scoped ?? [];
  const tmap = d.tmap ?? {};
  const balans = { W: 0, D: 0, L: 0 };
  for (const m of ms) {
    const o = outcomeFor(m, tmap, d.id);
    if (o) balans[o]++;
  }
  const gespeeld = balans.W + balans.D + balans.L;
  const best = d.best ?? 0;
  const voortgang = d.tierVoortgang;
  return (
    <>
      <span className="fut-kaart__stats-rij">
        <span className="fut-kaart__stats-label">Vorm</span>
        {form.length > 0 ? <FormChips form={form} size="sm" /> : "—"}
      </span>
      <span className="fut-kaart__stats-rij">
        <span className="fut-kaart__stats-label">Balans</span>
        <span
          aria-label={`${balans.W} winst, ${balans.D} gelijk, ${balans.L} verlies`}
        >
          {gespeeld > 0 ? `${balans.W}W · ${balans.D}G · ${balans.L}V` : "—"}
        </span>
      </span>
      <span className="profile-hero__statrij">
        <span className="fut-kaart__stats-rij">
          <span className="fut-kaart__stats-label">Klassement</span>
          <span>{d.rank != null ? `#${d.rank}` : "—"}</span>
        </span>
        <span className="fut-kaart__stats-rij">
          <span className="fut-kaart__stats-label">Beste</span>
          <span>{best > 0 ? best : "—"}</span>
        </span>
      </span>
      {voortgang?.volgende && voortgang.puntenNodig != null && (
        <span className="profile-hero__progress">
          Nog {voortgang.puntenNodig} → {voortgang.volgende.naam}{" "}
          {voortgang.volgende.emoji}
        </span>
      )}
    </>
  );
}

export default ProfileHero;
