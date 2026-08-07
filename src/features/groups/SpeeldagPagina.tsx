import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { useBackTo } from "@/lib/hooks/useBackTo";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { PollSkeleton } from "@/ui/Skeleton";
import { getGroup, getGroupMembers } from "@/features/groups/api";
import { getGroupMatches } from "@/features/matches/api";
import { getProfilesMap } from "@/features/profiles/api";
import {
  getGroupPollOptions,
  getGroupPollVotes,
  getPoll,
} from "@/features/groups/pollsApi";
import { pollOptions } from "@/features/groups/pollLogic";
import {
  roundsExistFor,
  roundsMadeFor,
} from "@/features/groups/planFlowLogic";
import { PollCard } from "@/features/groups/components/PollCard";
import "@/features/groups/Proposals.css";

/* ------------------------------------------------------------------ */
/* Eén speeldag als pagina (#1121).                                    */
/*                                                                     */
/* Tot nu toe was dit een toestand van de groepspagina: ?tab=plannen   */
/* &poll=<id>, waar PlanTab de gevraagde poll in focus zette. Nu de     */
/* agenda de ingang is, hoort de speeldag zelf adresseerbaar te zijn —  */
/* een deel-link, een pushbericht en de feed wijzen allemaal hierheen.  */
/*                                                                     */
/* De pagina is met opzet dun: ze haalt op wat PollCard nodig heeft en  */
/* zet die neer. Alle handelingen (kiezen, boeken, rondes, delen)       */
/* wonen in PollCard en WinnerCard en blijven daar.                     */
/* ------------------------------------------------------------------ */

export function SpeeldagPagina() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  // De poll eerst: alles hieronder hangt aan de groep waar hij in zit, en die
  // staat niet in de URL — een poll-id is genoeg om hem te vinden.
  const poll = useAsync(() => getPoll(id), [id]);
  const groupId = poll.data?.group_id ?? "";
  const heeftGroep = groupId !== "";

  const group = useAsync(() => getGroup(groupId), [groupId], {
    enabled: heeftGroep,
  });
  const members = useAsync(() => getGroupMembers(groupId), [groupId], {
    enabled: heeftGroep,
  });
  const options = useAsync(() => getGroupPollOptions(groupId), [groupId], {
    enabled: heeftGroep,
  });
  const votes = useAsync(() => getGroupPollVotes(groupId), [groupId], {
    enabled: heeftGroep,
  });
  // Alleen voor de Klaar-fase: staan er al rondes klaar voor deze speeldag?
  const matches = useAsync(() => getGroupMatches(groupId), [groupId], {
    enabled: heeftGroep,
  });
  const profiles = useAsync(getProfilesMap, []);

  usePageTitle(group.data ? `Speeldag — ${group.data.name}` : null);

  // Bij een deeplink uit een pushbericht is er geen vorige pagina; dan is de
  // agenda het vangnet, want daar hoort deze speeldag thuis (#910-patroon).
  const terug = useBackTo("/agenda");

  // Alleen wijzigingen binnen déze groep. Zolang de poll nog laadt kennen we
  // de groep niet en staat er geen filter op; dat duurt één ronde en de
  // reload die er dan uit volgt raakt alleen gecachte queries.
  const filter = heeftGroep ? `group_id=eq.${groupId}` : undefined;
  useRealtime("play_polls", poll.reload, filter);
  useRealtime("play_poll_options", options.reload, filter);
  useRealtime("play_poll_votes", votes.reload, filter);

  // Rondes die in deze sessie zijn klaargezet: laat de kaart meteen de
  // Klaar-fase tonen, nog vóór de matches-reload landt (zoals PlanTab deed).
  const [rondesGezet, setRondesGezet] = useState(false);

  function herlaad() {
    poll.reload();
    options.reload();
    votes.reload();
    matches.reload();
  }

  const fout = poll.error ?? group.error ?? options.error ?? votes.error;
  if (fout) return <ErrorRetry melding={fout} onRetry={herlaad} />;

  // Een poll die niet bestaat en een poll uit een groep waar je niet in zit
  // zijn voor RLS hetzelfde: allebei onvindbaar. Dat is geen fout, dus geen
  // ErrorRetry maar een eerlijk antwoord met de weg terug.
  if (!poll.loading && poll.data == null) {
    return (
      <ErrorRetry
        melding="Deze speeldag bestaat niet (meer) of je hebt er geen toegang toe."
        actie={
          <Link className="btn btn--sm" to="/agenda">
            Naar de agenda
          </Link>
        }
      />
    );
  }

  // Op de render waarin de poll net landde staan de vervolgqueries nog op
  // `enabled: false`-waarden (loading is dan nog false). Vandaar de check op
  // de data zelf: anders flitst er één frame lang een kaart zonder momenten.
  const speeldag = poll.data;
  const groep = group.data;
  const leden = members.data;
  const alleOpties = options.data;
  const alleStemmen = votes.data;

  if (
    speeldag == null ||
    groep == null ||
    leden == null ||
    alleOpties == null ||
    alleStemmen == null
  ) {
    return (
      <section className="card">
        <h2 className="card__title">Speeldag</h2>
        <PollSkeleton />
      </section>
    );
  }

  const eigenOpties = pollOptions(speeldag, alleOpties);
  const alleMatches = matches.data ?? [];

  return (
    <div>
      <header className="page-head">
        {/* De kaart eronder draagt de eigenlijke kop ("Geboekte speeldag");
            deze regel zegt waar je bent en hoe je terugkomt. */}
        <h1 className="sr-only">Speeldag</h1>
        <div className="row-between">
          <button className="btn btn--sm" onClick={terug}>
            ← Terug
          </button>
          {/* De groepsnaam is hier geen sier: op de groepspagina wist je in
              welke groep je zat, op een gedeelde link niet. Meteen ook de
              weg naar die groep. */}
          <Link className="btn btn--sm" to={`/groepen/${groupId}`}>
            {groep.name}
          </Link>
        </div>
      </header>

      <PollCard
        poll={speeldag}
        groupName={groep.name}
        members={leden}
        options={eigenOpties}
        votes={alleStemmen}
        profiles={profiles.data ?? {}}
        myId={myId}
        isOwner={groep.created_by === myId}
        onChanged={herlaad}
        roundsExist={roundsExistFor(speeldag, alleMatches) || rondesGezet}
        rondesVandaag={roundsMadeFor(speeldag, alleMatches)}
        onRoundsMade={() => setRondesGezet(true)}
      />
    </div>
  );
}

export default SpeeldagPagina;
