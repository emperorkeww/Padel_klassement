import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { dateInZone } from "@/lib/utils/time";
import { getWeekAvailability, type WeekDay } from "@/features/availability/api";
import { ClubPicker } from "@/features/availability/components/ClubPicker";
import type { Club } from "@/features/availability/club";
import { createPoll } from "@/features/groups/pollsApi";
import { PollWizard } from "./PollWizard";
import { PollWizardSheet } from "./PollWizardSheet";

/* ------------------------------------------------------------------ */
/* Een nieuwe speeldag starten (#1091).                                */
/*                                                                     */
/* Eén plek voor de hele aanmaakflow: clubkeuze, vrije banen van die   */
/* club, wizard, createPoll. Sinds #1121 opent de agenda hem als enige, */
/* met een `initialDay` erbij.                                          */
/*                                                                     */
/* De clubkeuze staat hier en nergens anders (#1271): het plan-sheet    */
/* ervoor vroeg hem ook, op dezelfde state, en dat is twee keer dezelfde*/
/* vraag in twee schermen. Hier heeft ze betekenis — de vrije banen per */
/* slot hieronder komen van deze club.                                  */
/* ------------------------------------------------------------------ */

export function NieuweSpeeldagSheet({
  open,
  groupId,
  myId,
  club,
  onClub,
  initialDay,
  storageKey,
  onClose,
  onCreated,
}: {
  open: boolean;
  groupId: string;
  myId: string;
  /** Locatie voor déze poll; los van de globale clubvoorkeur (#322). */
  club: Club;
  onClub: (club: Club) => void;
  /** Dag waarop de wizard opent — de aangetikte dag in de agenda. */
  initialDay?: string;
  /** sessionStorage-sleutel zodat de selectie een uitstap naar /banen overleeft. */
  storageKey?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const today = dateInZone(club.timezone);
  // Pas ophalen als het sheet echt opengaat: dit hangt onder een pagina die
  // ook zonder wizard nut heeft, en een dicht sheet hoeft geen banen te kennen.
  const week = useAsync<WeekDay[]>(
    () => getWeekAvailability(today, 7, club),
    [today, club.id],
    { enabled: open },
  );

  return (
    <PollWizardSheet
      open={open}
      onClose={onClose}
      title="Nieuwe speeldag"
      headerExtra={<ClubPicker value={club} onPick={onClub} allowManual />}
    >
      <PollWizard
        today={today}
        week={week.data ?? []}
        weekLoading={week.loading}
        club={club}
        initialDay={initialDay}
        storageKey={storageKey}
        submitLabel={(n) => `Start poll (${n})`}
        onSubmit={async (opts) => {
          await createPoll({
            groupId,
            createdBy: myId,
            club,
            options: opts,
          });
          toast.success("Poll gestart — de groep kan stemmen.");
        }}
        onClose={onClose}
        onDone={() => {
          onClose();
          onCreated();
        }}
      />
    </PollWizardSheet>
  );
}

export default NieuweSpeeldagSheet;
