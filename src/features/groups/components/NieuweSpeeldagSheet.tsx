import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { dateInZone } from "@/lib/utils/time";
import { getWeekAvailability, type WeekDay } from "@/features/availability/api";
import { ClubPicker } from "@/features/availability/components/ClubPicker";
import type { Club } from "@/features/availability/club";
import type { GroupSummary } from "@/features/groups/api";
import { createPoll } from "@/features/groups/pollsApi";
import { longDay } from "@/features/groups/planPollHelpers";
import { GroepPicker } from "./GroepPicker";
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
/*                                                                      */
/* Sinds #1308 geldt dat ook voor de groep, en is dat plan-sheet ermee   */
/* verdwenen: het stelde één vraag, opende met een dode hoofdknop en had */
/* een "Terug" die de hele keten sloot. De kop draagt nu groep, club én  */
/* dag — met twee groepen die allebei op donderdag spelen was dat het    */
/* enige wat je nog fout kon hebben, en het stond nergens.               */
/* ------------------------------------------------------------------ */

export function NieuweSpeeldagSheet({
  open,
  groepen = [],
  groupId,
  onGroep,
  myId,
  club,
  onClub,
  initialDay,
  storageKey,
  bezetteDagen,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** Je groepen, voor de kiezer in de kop (#1308). */
  groepen?: GroupSummary[];
  groupId: string;
  onGroep?: (id: string) => void;
  myId: string;
  /** Locatie voor déze poll; los van de globale clubvoorkeur (#322). */
  club: Club;
  onClub: (club: Club) => void;
  /** Dag waarop de wizard opent — de aangetikte dag in de agenda. */
  initialDay?: string;
  /** sessionStorage-sleutel zodat de selectie een uitstap naar /banen overleeft. */
  storageKey?: string;
  /** Dagen waarop al een speeldag staat (#1308): een stip in de dagstrip. */
  bezetteDagen?: Set<string>;
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
      title="Speeldag plannen"
      headerExtra={
        <>
          {/* Voor wie, waar en wanneer — de drie dingen die vaststaan terwijl
              je momenten aantikt (#1308). */}
          {groepen.length > 0 && onGroep && (
            <GroepPicker groepen={groepen} groupId={groupId} onGroep={onGroep} />
          )}
          <ClubPicker value={club} onPick={onClub} allowManual />
          {initialDay && (
            <p className="wizard-sheet__dag">{longDay(initialDay)}</p>
          )}
        </>
      }
    >
      <PollWizard
        today={today}
        week={week.data ?? []}
        weekLoading={week.loading}
        club={club}
        initialDay={initialDay}
        storageKey={storageKey}
        bezetteDagen={bezetteDagen}
        submitLabel={(n) => `Start speeldag (${n})`}
        onSubmit={async (opts) => {
          await createPoll({
            groupId,
            createdBy: myId,
            club,
            options: opts,
          });
          toast.success("Speeldag staat open — de groep kan stemmen.");
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
