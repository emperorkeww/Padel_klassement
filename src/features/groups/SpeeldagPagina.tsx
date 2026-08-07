import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { useBackTo } from "@/lib/hooks/useBackTo";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { PollSkeleton } from "@/ui/Skeleton";
import { getGroup, getGroupMembers } from "@/features/groups/api";
import { getGroupMatches, getTeamsMap } from "@/features/matches/api";
import { getRatingHistoriesForMatches } from "@/features/standings/ratingsApi";
import { upsetsByMatch } from "@/features/matches/upset";
import { getProfilesMap } from "@/features/profiles/api";
import {
  getGroupPollOptions,
  getGroupPollVotes,
  getPoll,
} from "@/features/groups/pollsApi";
import { pollOptions, tallyOption } from "@/features/groups/pollLogic";
import {
  matchesVoorSpeeldag,
  speeldagMoment,
} from "@/features/groups/speeldagMatches";
import { rondesOpDag } from "@/features/groups/speeldagRondes";
import { groupByRound } from "@/features/groups/groupDetailHelpers";
import { PollCard } from "@/features/groups/components/PollCard";
import { RondeBlok } from "@/features/groups/components/RondeBlok";
import { VolgendeRonde } from "@/features/groups/components/VolgendeRonde";
import { LossePartij } from "@/features/groups/components/LossePartij";
import { dateInZone } from "@/lib/utils/time";
import type { Match, Profile } from "@/types";
import "@/features/groups/Proposals.css";

/* ------------------------------------------------------------------ */
/* Eén speeldag als pagina (#1121).                                    */
/*                                                                     */
/* Tot nu toe was dit een toestand van de groepspagina: ?tab=plannen   */
/* &poll=<id>, waar PlanTab de gevraagde poll in focus zette. Nu de     */
/* agenda de ingang is, hoort de speeldag zelf adresseerbaar te zijn —  */
/* een deel-link, een pushbericht en de feed wijzen allemaal hierheen.  */
/*                                                                     */
/* Alle handelingen rond de póll (kiezen, boeken, rondes klaarzetten,   */
/* delen) wonen in PollCard en WinnerCard en blijven daar.              */
/*                                                                     */
/* Sinds #1133 staan de wedstrijden van die dag er ook (#1133). Ze      */
/* stonden alleen op de Spelen-tab, en die filtert hard op vandaag:     */
/* zette je vanuit de agenda de rondes klaar voor volgende week, dan    */
/* waren ze nergens te zien — ook niet op de pagina waar je ze maakte.  */
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
  // De volledige groepshistorie: waar de wedstrijden van deze dag uit komen,
  // en tegelijk de context die de geplande kaarten gebruiken (rivaliteit,
  // coach). De dagfilter zit hieronder, niet in de query.
  const matches = useAsync(() => getGroupMatches(groupId), [groupId], {
    enabled: heeftGroep,
  });
  const profiles = useAsync(getProfilesMap, []);

  // Het vastgelegde moment bepaalt welke dag deze pagina laat zien. Zolang er
  // niets vastligt (open of geannuleerd) is er geen dag en dus geen blok.
  const moment = useMemo(() => {
    const p = poll.data;
    const o = options.data;
    if (p == null || o == null) return null;
    return speeldagMoment(p, pollOptions(p, o));
  }, [poll.data, options.data]);

  const dagMatches = useMemo(
    () =>
      moment
        ? matchesVoorSpeeldag(matches.data ?? [], moment.dag, moment.tz)
        : [],
    [moment, matches.data],
  );

  // Teams en rating-historie horen bij de wedstrijdkaarten, dus ze hoeven pas
  // te laden zodra die er zijn. Bewust `…ForMatches` en niet de "recente"
  // historie: een speeldag uit het verleden valt daar buiten.
  const heeftMatches = dagMatches.length > 0;
  const teams = useAsync(getTeamsMap, [], { enabled: heeftMatches });
  const matchIds = dagMatches.map((m) => m.id).join(",");
  const histories = useAsync(
    () => getRatingHistoriesForMatches(matchIds ? matchIds.split(",") : []),
    [matchIds],
    { enabled: heeftMatches },
  );

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

  // Rondes die de gebruiker zelf open- of dichtklapte. Wat er niet in staat
  // volgt de dag: een afgeronde ronde klapt dicht, de ronde met openstaande
  // uitslagen blijft open — zelfde afspraak als op de Spelen-tab.
  const [geklapt, setGeklapt] = useState<Record<number, boolean>>({});
  const rondeOpen = (round: number, list: Match[]) =>
    geklapt[round] ?? list.some((m) => m.status !== "completed");

  const upsets = useMemo(
    () => upsetsByMatch(dagMatches, teams.data ?? {}, histories.data ?? {}),
    [dagMatches, teams.data, histories.data],
  );

  function herlaad() {
    poll.reload();
    options.reload();
    votes.reload();
    matches.reload();
  }

  /** Na een uitslag, correctie of verwijdering: de match zelf én alles wat
   *  eruit volgt (teams bij een nieuwe combinatie, rating-historie). */
  function herlaadMatches() {
    herlaad();
    teams.reload();
    histories.reload();
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
  // Rondes die op deze dag klaarstaan. Dit verving de oude afleiding uit
  // planFlowLogic ("aangemaakt ná booked_at"), die twee speeldagen in dezelfde
  // week door elkaar haalde; de dag zelf is een scherpere sleutel.
  const rondesKlaar = moment
    ? rondesOpDag(dagMatches, moment.tz, moment.dag)
    : 0;
  const rondes = groupByRound(dagMatches);
  const intensiteit = groep.roast_intensiteit ?? "radioactief";
  // Een ronde van deze dag met openstaande uitslagen blokkeert Mexicano: die
  // vorm paart op de volledige stand en heeft dus alle uitslagen nodig.
  const openRonde =
    rondes.find(({ list }) => list.some((m) => m.status !== "completed")) ??
    null;

  // Groepsleden als profiel: de kiesbare spelers bij een losse partij.
  const groepSpelers = leden
    .map((m) => profiles.data?.[m.player_id])
    .filter(Boolean) as Profile[];
  // Datum en starttijd staan al in clubtijd, dus het datetime-local-veld kan
  // ze rechtstreeks overnemen — geen conversie, en niets dat op een DST-grens
  // een uur verschuift.
  const momentVeld = moment
    ? `${moment.option.date}T${moment.option.start_time}`
    : null;
  // Op een dag die nog moet komen plan je een partij, op een dag die loopt of
  // geweest is log je hem. De clubdag van de speeldag beslist, niet die van de
  // browser.
  const nogTeGaan = moment != null && moment.dag > dateInZone(moment.tz);

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
        roundsExist={rondesKlaar > 0 || rondesGezet}
        rondesVandaag={rondesKlaar}
        wedstrijdenAnker={rondes.length > 0 ? "#speeldag-wedstrijden" : undefined}
        onRoundsMade={() => setRondesGezet(true)}
      />

      {/* Losse partij op deze speeldag (#1133): buiten de rondes om gespeeld of
          nog in te plannen. Voorgevuld met het uur van deze avond, want dat is
          waar je bent — niet "nu". Alleen zodra het moment vastligt: zonder
          datum is er geen avond om iets bij te zetten. */}
      {moment && (
        <LossePartij
          groupId={groupId}
          players={groepSpelers}
          intensiteit={intensiteit}
          moment={momentVeld}
          standaardModus={nogTeGaan ? "plan" : "score"}
          onCreated={herlaadMatches}
          onGuestCreated={() => profiles.reload()}
        />
      )}

      {/* De wedstrijden van deze dag (#1133) — dezelfde rondeblokken als op de
          Spelen-tab, zodat een uitslag invullen overal hetzelfde werkt. Losse
          partijen van die dag staan er onder "Losse matches" bij: ze horen bij
          de avond, precies zoals in de Spelen-tab. */}
      {rondes.length > 0 && (
        <section className="card" id="speeldag-wedstrijden">
          <div className="card__head">
            <h2 className="card__title card__title--tight">Wedstrijden</h2>
          </div>
          <p className="card__subtitle">
            De wedstrijden van deze speeldag — vul de uitslagen in en de
            groepsstand rekent mee.
          </p>

          <div className="rounds">
            {rondes.map(({ round, list }) => (
              <RondeBlok
                key={round}
                round={round}
                list={list}
                open={rondeOpen(round, list)}
                onToggle={() =>
                  setGeklapt((cur) => ({
                    ...cur,
                    [round]: !rondeOpen(round, list),
                  }))
                }
                teams={teams.data ?? {}}
                profiles={profiles.data ?? {}}
                myId={myId}
                isOwner={groep.created_by === myId}
                matches={matches.data ?? []}
                intensiteit={intensiteit}
                upsets={upsets}
                onMatches={herlaadMatches}
              />
            ))}
          </div>

          {/* Een ronde toevoegen aan déze speeldag (#1133). De eerste ronde
              komt uit de kaart hierboven (Elo, in één tik); dit is dezelfde
              generator als op de Spelen-tab, met de speeldag meegegeven zodat
              de nieuwe rondes de starttijd van die avond krijgen in plaats van
              die van vandaag. */}
          {moment && (
            <VolgendeRonde
              groupId={groupId}
              members={leden}
              profiles={profiles.data ?? {}}
              myId={myId}
              matches={matches.data ?? []}
              teams={teams.data ?? {}}
              openRound={openRonde}
              speeldag={{
                dag: moment.dag,
                option: moment.option,
                poll: speeldag,
                yes: tallyOption(moment.option, alleStemmen).yes,
              }}
              onGenerated={herlaadMatches}
            />
          )}
        </section>
      )}
    </div>
  );
}

export default SpeeldagPagina;
