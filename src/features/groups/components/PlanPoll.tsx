import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { Skeleton } from "@/ui/Skeleton";
import { dateInZone } from "@/lib/utils/time";
import { getWeekAvailability, type WeekDay } from "@/features/availability/api";
import { useClub, type Club } from "@/features/availability/club";
import { ClubPicker } from "@/features/availability/components/ClubPicker";
import {
  getGroupPolls,
  getGroupPollOptions,
  getGroupPollVotes,
  createPoll,
  type PlayPoll,
  type PollOption,
  type PollVote,
} from "@/features/groups/pollsApi";
import { activePolls, pollOptions } from "@/features/groups/pollLogic";
import type { GroupMember, Profile } from "@/types";
import { PollCard } from "./PollCard";
import { PollWizard } from "./PollWizard";
import "@/features/groups/Proposals.css";

// Speeldag-poll: de doodle van de Plannen-tab. Wizard met dag-navigator
// (alleen échte vrije slots kiesbaar), stemmen per optie in compacte rijen
// met een ✓ ? ✗-segment, en een duidelijk fase-verloop:
// Stemmen → Gekozen → Geboekt.

/* ------------------------------------------------------------------ */
/* Sectie: haalt de data op en kiest tussen poll-kaart en wizard.      */
/* ------------------------------------------------------------------ */

export function PollSection({
  groupId,
  groupName,
  members,
  profiles,
  myId,
  isOwner,
}: {
  groupId: string;
  groupName: string;
  members: GroupMember[];
  profiles: Record<string, Profile>;
  myId: string;
  isOwner: boolean;
}) {
  const globalClub = useClub();
  const toast = useToast();
  // Locatie voor een nieuwe poll (#322): start op de globale clubkeuze, maar de
  // maker kan hem per poll overschrijven. De keuze wordt op de poll opgeslagen,
  // dus een latere globale clubwissel raakt bestaande polls niet meer.
  const [newPollClub, setNewPollClub] = useState<Club>(globalClub);
  const today = dateInZone(newPollClub.timezone);
  // De wizard-selectie overleeft een uitstap naar /banen (zelfde tabblad,
  // swipe-terug): picks staan in sessionStorage en de wizard heropent vanzelf.
  const wizardStorageKey = `poll-wizard:${groupId}`;
  const [wizardOpen, setWizardOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(wizardStorageKey) != null;
    } catch {
      return false;
    }
  });
  const closeWizard = () => {
    try {
      sessionStorage.removeItem(wizardStorageKey);
    } catch {
      /* opslag niet beschikbaar — geen probleem */
    }
    setWizardOpen(false);
  };

  const polls = useAsync<PlayPoll[]>(() => getGroupPolls(groupId), [groupId]);
  const options = useAsync<PollOption[]>(
    () => getGroupPollOptions(groupId),
    [groupId],
  );
  const votes = useAsync<PollVote[]>(() => getGroupPollVotes(groupId), [groupId]);
  useRealtime("play_polls", polls.reload, `group_id=eq.${groupId}`);
  useRealtime("play_poll_options", options.reload, `group_id=eq.${groupId}`);
  useRealtime("play_poll_votes", votes.reload, `group_id=eq.${groupId}`);

  // Vrije banen (7-daags venster) van de gekozen nieuwe-poll-club: voedt de
  // aanmaak-wizard. Bestaande polls halen hun eigen club-beschikbaarheid op.
  const week = useAsync<WeekDay[]>(
    () => getWeekAvailability(today, 7, newPollClub),
    [today, newPollClub.id],
  );

  const active = useMemo(
    () => activePolls(polls.data ?? [], options.data ?? [], today),
    [polls.data, options.data, today],
  );

  function reloadAll() {
    polls.reload();
    options.reload();
    votes.reload();
  }

  if (polls.loading || options.loading) {
    return (
      <section className="card">
        <h2 className="card__title">Speeldag plannen</h2>
        <Skeleton rows={3} />
      </section>
    );
  }

  // Banen-verkenning altijd zichtbaar op de Plannen-tab (niet alleen in de
  // wizard): in de app zelf, dus swipe-terug brengt je hier weer terug.
  const banenLink = (
    <p className="plan-banen">
      <Link to={`/banen?datum=${today}`}>🎾 Vrije banen bekijken →</Link>
    </p>
  );

  // Meerdere speeldagen tegelijk (#267): elke actieve poll krijgt een eigen
  // kaart, en de "plannen"-kaart eronder is er altijd om er nog één te starten.
  return (
    <>
      {active.map((poll) => (
        <PollCard
          key={poll.id}
          poll={poll}
          groupName={groupName}
          members={members}
          options={pollOptions(poll, options.data ?? [])}
          votes={votes.data ?? []}
          profiles={profiles}
          myId={myId}
          isOwner={isOwner}
          onChanged={reloadAll}
        />
      ))}

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">
            {active.length > 0 ? "Nog een speeldag plannen" : "Speeldag plannen"}
          </h2>
          {wizardOpen ? (
            // Locatie voor deze nieuwe poll — los van de globale clubvoorkeur.
            <ClubPicker value={newPollClub} onPick={setNewPollClub} allowManual align="right" />
          ) : (
            <button
              className="btn btn--sm btn--primary"
              onClick={() => setWizardOpen(true)}
            >
              + Plan een speeldag
            </button>
          )}
        </div>
        {!wizardOpen && active.length === 0 && (
          <p className="empty">
            Geen lopende poll. Kies een paar momenten waarop banen vrij zijn en
            laat de groep stemmen.
          </p>
        )}
        {wizardOpen && (
          <PollWizard
            today={today}
            week={week.data ?? []}
            weekLoading={week.loading}
            club={newPollClub}
            storageKey={wizardStorageKey}
            submitLabel={(n) => `Start poll (${n})`}
            onSubmit={async (options) => {
              await createPoll({ groupId, createdBy: myId, club: newPollClub, options });
              toast.success("Poll gestart — de groep kan stemmen.");
            }}
            onClose={closeWizard}
            onDone={() => {
              closeWizard();
              reloadAll();
            }}
          />
        )}
        {!wizardOpen && banenLink}
      </section>
    </>
  );
}

export default PollSection;
