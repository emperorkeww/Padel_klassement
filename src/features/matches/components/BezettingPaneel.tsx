import { useMemo, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { useConfirm } from "@/ui/ConfirmDialog";
import { errorMessage } from "@/lib/utils/errors";
import { tap } from "@/lib/utils/haptics";
import { ruilSpelers, wisselSpeler } from "@/features/admin/matchBeheer";
import { getGroupMembers } from "@/features/groups/api";
import { categorize, getMyFriendships, otherId } from "@/features/friends/api";
import { displayName, getProfilesByIds } from "@/features/profiles/api";
import { playersOf } from "@/features/rating/results";
import type { Match, Profile, Team } from "@/types";

/* ------------------------------------------------------------------ */
/* Wie staat er op de baan? (#1327)                                    */
/*                                                                     */
/* Zodra de rondes van een speeldag klaarstonden lag de opstelling     */
/* vast. Zegde er iemand af, dan was de enige weg terug elke match los */
/* verwijderen en een nieuwe ronde bijmaken — die dan een hoger nummer */
/* kreeg en onderaan het rijtje belandde (#1271 §2.7/§2.8).            */
/*                                                                     */
/* De drie handelingen uit het issue — vervangen, van team wisselen,   */
/* ruilen met een andere baan — staan hier bewust niet als drie        */
/* formulieren onder elkaar. Ze beantwoorden dezelfde twee vragen:     */
/* "wie gaat er weg van deze plek" en "wie komt ervoor in de plaats".  */
/* De tweede lijst bepaalt wélke handeling het wordt:                  */
/*                                                                     */
/*   iemand die niet speelt   → vervangen                              */
/*   iemand uit het andere team → van team wisselen                    */
/*   iemand van een andere baan → ruilen                               */
/*                                                                     */
/* Eén paneel, twee gastheren: het ⋯-menu van de wedstrijdkaart op de  */
/* speeldag, en het matchdetail.                                       */
/* ------------------------------------------------------------------ */

/** Wat er met de gekozen tegenpartij gebeurt. Puur afgeleid uit wie het is. */
type Handeling = "vervangen" | "wisselen" | "ruilen";

type Optie = {
  id: string;
  naam: string;
  handeling: Handeling;
  /** Bij "ruilen": de wedstrijd waar die speler nu in staat. */
  matchId: string;
};

export function BezettingPaneel({
  match: m,
  teams,
  profiles,
  myId,
  alsBeheerder,
  buurmatches = [],
  onSaved,
  onKlaar,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  myId: string;
  /** Komt het recht enkel uit de beheerdersrol? Dan loopt het schrijfpad via
   *  `admin-content` (#1159). Kies `bezettingAlsBeheerder`, niet
   *  `alsBeheerder` — zie matchRechten(). */
  alsBeheerder: boolean;
  /** Andere wedstrijden waarmee geruild kan worden: de banen van dezelfde
   *  ronde. Laat weg waar die context er niet is (het matchdetail), dan valt
   *  het ruilen vanzelf weg. */
  buurmatches?: Match[];
  onSaved: () => void;
  /** Sluit de gastheer (sheet) na een gelukte wijziging. */
  onKlaar?: () => void;
}) {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const [wieId, setWieId] = useState("");
  const [naarId, setNaarId] = useState("");
  const [busy, setBusy] = useState(false);

  const isAfgerond = m.status === "completed";

  const spelers = useMemo(
    () => [
      ...playersOf(teams[m.team_a_id]),
      ...playersOf(teams[m.team_b_id]),
    ],
    [teams, m.team_a_id, m.team_b_id],
  );

  const members = useAsync(
    () => (m.group_id ? getGroupMembers(m.group_id) : Promise.resolve([])),
    [m.group_id],
  );
  const friendships = useAsync(getMyFriendships, []);

  // Wie er op de andere banen staat. Alleen nog niet gespeelde wedstrijden uit
  // dezelfde groep: een ruil over die grenzen heen weigert de RPC toch, en een
  // afgeronde baan is geen plek meer om iemand naartoe te schuiven.
  const buren = useMemo(
    () =>
      buurmatches.filter(
        (b) =>
          b.id !== m.id &&
          b.group_id === m.group_id &&
          b.status !== "completed" &&
          b.status !== "cancelled",
      ),
    [buurmatches, m.id, m.group_id],
  );

  const bezet = useMemo(
    () => [
      ...spelers,
      ...buren.flatMap((b) => [
        ...playersOf(teams[b.team_a_id]),
        ...playersOf(teams[b.team_b_id]),
      ]),
    ],
    [spelers, buren, teams],
  );

  // Invallers: dezelfde populatie die `_can_add_player` toelaat — jezelf, een
  // vriend, je eigen gast of een groepsgenoot — minus iedereen die deze ronde
  // al op een baan staat. Zo biedt de lijst niets aan wat de RPC weigert, en
  // belandt niemand op twee banen tegelijk; wie elders speelt verschijnt
  // hieronder wél, maar als ruilpartner.
  const invallerIds = useMemo(() => {
    const alles = [
      ...(members.data ?? []).map((x) => x.player_id),
      ...categorize(friendships.data ?? [], myId).accepted.map((f) =>
        otherId(f, myId),
      ),
      myId,
    ];
    return alles.filter(
      (pid, i) => alles.indexOf(pid) === i && !bezet.includes(pid),
    );
  }, [members.data, friendships.data, myId, bezet]);

  const invallerKey = invallerIds.slice().sort().join(",");
  const invallerProfielen = useAsync(
    () => getProfilesByIds(invallerIds),
    [invallerKey],
  );

  // Als eigen memo: `?? {}` zou anders elke render een verse verwijzing geven
  // en de lijst hieronder telkens opnieuw laten opbouwen.
  const invallerMap = useMemo(
    () => invallerProfielen.data ?? {},
    [invallerProfielen.data],
  );
  const naam = (pid: string) => displayName(profiles[pid] ?? invallerMap[pid]);

  // De tegenpartij-lijst. De volgorde is de volgorde van de optgroups eronder:
  // eerst wie erbij kan komen, dan wie er al is.
  const opties: Optie[] = useMemo(() => {
    if (wieId === "") return [];

    // Invallers: geen gasten van iemand anders — die zou de RPC weigeren.
    const invallers: Optie[] = invallerIds
      .filter(
        (pid) =>
          invallerMap[pid] &&
          (!invallerMap[pid].is_guest || invallerMap[pid].owner_id === myId),
      )
      .map((pid) => ({
        id: pid,
        naam: displayName(invallerMap[pid]),
        handeling: "vervangen" as const,
        matchId: m.id,
      }))
      .sort((a, b) => a.naam.localeCompare(b.naam));

    // Van team wisselen kan alleen met de overkant; twee teamgenoten omdraaien
    // verandert niets en wordt door de RPC geweigerd.
    const mijnKant = playersOf(teams[m.team_a_id]).includes(wieId) ? "a" : "b";
    const overkant = playersOf(
      teams[mijnKant === "a" ? m.team_b_id : m.team_a_id],
    ).map((pid) => ({
      id: pid,
      naam: displayName(profiles[pid]),
      handeling: "wisselen" as const,
      matchId: m.id,
    }));

    const elders = buren.flatMap((b) =>
      [...playersOf(teams[b.team_a_id]), ...playersOf(teams[b.team_b_id])]
        // Wie in béide wedstrijden staat kun je niet met zichzelf ruilen.
        .filter((pid) => !spelers.includes(pid))
        .map((pid) => ({
          id: pid,
          naam: displayName(profiles[pid]),
          handeling: "ruilen" as const,
          matchId: b.id,
        })),
    );

    return [...invallers, ...overkant, ...elders];
  }, [
    wieId,
    invallerIds,
    invallerMap,
    myId,
    m.id,
    m.team_a_id,
    m.team_b_id,
    teams,
    profiles,
    buren,
    spelers,
  ]);

  const gekozen = opties.find((o) => o.id === naarId) ?? null;

  /** Eén zin die zegt wat er staat te gebeuren. Ook de kop van de bevestiging:
   *  hetzelfde verhaal vóór en tijdens de klik. */
  function samenvatting(o: Optie): string {
    if (o.handeling === "vervangen") {
      return `${naam(wieId)} wordt vervangen door ${o.naam}.`;
    }
    if (o.handeling === "wisselen") {
      return `${naam(wieId)} en ${o.naam} wisselen van team.`;
    }
    return `${naam(wieId)} en ${o.naam} ruilen van baan.`;
  }

  async function voerUit() {
    if (!gekozen) return;
    const staart = isAfgerond
      ? " Deze wedstrijd is al gespeeld, dus alle ratings worden opnieuw berekend."
      : "";
    if (
      !(await confirm({
        title: "Bezetting wijzigen?",
        body: `${samenvatting(gekozen)}${staart} Dit kan niet ongedaan worden gemaakt.`,
        confirmLabel: "Wijzigen",
      }))
    )
      return;

    setBusy(true);
    try {
      if (gekozen.handeling === "vervangen") {
        await wisselSpeler(
          { matchId: m.id, vanSpeler: wieId, naarSpeler: gekozen.id },
          alsBeheerder,
        );
      } else {
        await ruilSpelers(
          {
            matchA: m.id,
            spelerA: wieId,
            matchB: gekozen.matchId,
            spelerB: gekozen.id,
          },
          alsBeheerder,
        );
      }
      tap();
      toast.success("Bezetting bijgewerkt.");
      setWieId("");
      setNaarId("");
      onSaved();
      onKlaar?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const invallers = opties.filter((o) => o.handeling === "vervangen");
  const overkant = opties.filter((o) => o.handeling === "wisselen");
  const elders = opties.filter((o) => o.handeling === "ruilen");

  return (
    <div className="stack">
      {alsBeheerder && (
        <p className="field-hint">
          Je doet dit als beheerder van de app, niet als deelnemer. Het wordt
          gelogd.
        </p>
      )}

      <div className="row-between">
        <span>Wie verandert van plek?</span>
        <select
          className="select"
          aria-label="Wie verandert van plek"
          disabled={busy}
          value={wieId}
          onChange={(e) => {
            setWieId(e.target.value);
            setNaarId("");
          }}
        >
          <option value="">Kies een speler…</option>
          {spelers.map((pid) => (
            <option key={pid} value={pid}>
              {naam(pid)}
            </option>
          ))}
        </select>
      </div>

      <div className="row-between">
        <span>Wie komt op die plek?</span>
        <select
          className="select"
          aria-label="Wie komt op die plek"
          disabled={busy || wieId === "" || invallerProfielen.loading}
          value={naarId}
          onChange={(e) => setNaarId(e.target.value)}
        >
          <option value="">Kies een speler…</option>
          {invallers.length > 0 && (
            <optgroup label="Speelt nog niet mee">
              {invallers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.naam}
                </option>
              ))}
            </optgroup>
          )}
          {overkant.length > 0 && (
            <optgroup label="Uit het andere team">
              {overkant.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.naam}
                </option>
              ))}
            </optgroup>
          )}
          {elders.length > 0 && (
            <optgroup label="Van een andere baan">
              {elders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.naam}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* De uitkomst in gewone taal, vóór de klik. Wie uit de overkant of van
          een andere baan kiest doet iets anders dan wie een invaller kiest, en
          dat mag niet pas in de bevestiging blijken. */}
      {gekozen && <p className="field-hint">{samenvatting(gekozen)}</p>}

      {wieId !== "" && !invallerProfielen.loading && opties.length === 0 && (
        <p className="field-hint">
          Geen speler om uit te kiezen. Voeg iemand eerst toe als vriend of als
          lid van de groep.
        </p>
      )}

      <div className="form-actions">
        <button
          className="btn btn--sm"
          disabled={busy || !gekozen}
          onClick={() => void voerUit()}
        >
          {busy ? "Bezig…" : "Bezetting wijzigen"}
        </button>
      </div>
      {confirmUi}
    </div>
  );
}

export default BezettingPaneel;
