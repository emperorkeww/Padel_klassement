import { useEffect, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useFluit } from "@/lib/hooks/useFluit";
import { useToast } from "@/ui/ToastProvider";
import { tap } from "@/lib/utils/haptics";
import { displayName } from "@/features/profiles/api";
import { readSetScores } from "@/features/matches/api";
import {
  REDENEN,
  TOELICHTING_MAX,
  appealBlokkade,
  appealFoutMelding,
  blokkadeUitleg,
  draaitWinnaarOm,
  kantVan,
  naCorrectie,
  stemStand,
  stemgerechtigden,
  type AppealReden,
  type PointAppeal,
} from "@/features/matches/appeal";
import {
  castAppealVote,
  createAppeal,
  getAppealVotes,
  getMatchAppeals,
  getPlayerAppeals,
} from "@/features/matches/appealApi";
import { roastCtx } from "@/features/coach/roastTone";
import { varUitspraak, type VarUitkomst } from "@/features/coach/varUitspraak";
import type { Group, Match, Profile, Team } from "@/types";
import "./VarBlock.css";

/**
 * Rudy's VAR (#1025): één punt betwisten, de groep stemt.
 *
 * Het beroep gaat over de eindstand (score_a/score_b) en niet over een rij uit
 * match_points — die tabel wordt door niets gevuld. Eén toegekend punt
 * verschuift de kopscore één eenheid, en als er een set-stand is beweegt de
 * aangeduide set mee. Zie appeal.ts voor de spiegel van de guard.
 *
 * Het blok verbergt zichzelf als er niets te zien én niets te doen is: op een
 * oude match zonder zaak, of voor iemand die niet meespeelde. Loopt er wél een
 * zaak, dan ziet de hele groep hem — dat is de ceremonie.
 *
 * De uitspraak van Rudy zelf en de feedkaart volgen in een eigen PR; hier
 * staat de procedure.
 */
export function VarBlock({
  match: m,
  teams,
  profiles,
  myId,
  group,
  onChanged,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  myId: string | null;
  /** Groep van de match — bepaalt de roast-toon van Rudy's uitspraak. */
  group?: Pick<Group, "roast_intensiteit"> | null;
  onChanged?: () => void;
}) {
  const toast = useToast();
  const { fluit, muted, toggleMute } = useFluit();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reden, setReden] = useState<AppealReden>("ons-punt");
  const [setNr, setSetNr] = useState(1);
  const [toelichting, setToelichting] = useState("");

  const appeals = useAsync(() => getMatchAppeals(m.id), [m.id]);
  const zaak: PointAppeal | null = (appeals.data ?? [])[0] ?? null;
  const loopt = zaak?.status === "open" ? zaak : null;

  const votes = useAsync(
    () => (loopt ? getAppealVotes(loopt.id) : Promise.resolve([])),
    [loopt?.id ?? ""],
  );
  const eigen = useAsync(
    () => (myId ? getPlayerAppeals(myId) : Promise.resolve([])),
    [myId ?? ""],
  );

  // Rudy's fluitsignaal bij de uitspraak: één keer per zaak, zodra die niet
  // meer openstaat. Bewust hier, vóór de vroege returns verderop — hooks mogen
  // niet achter een conditie staan.
  const zaakId = zaak?.id ?? null;
  const uitkomst: VarUitkomst | null =
    zaak && zaak.status !== "open" ? (zaak.status as VarUitkomst) : null;
  useEffect(() => {
    if (zaakId && uitkomst) fluit(zaakId);
  }, [zaakId, uitkomst, fluit]);

  const naam = (id: string) =>
    profiles[id] ? displayName(profiles[id]) : "iemand";
  const sets = readSetScores(m);

  const blokkade = myId
    ? appealBlokkade({
        match: m,
        teams,
        claimantId: myId,
        openAppeal: zaak,
        eigenAppeals: eigen.data ?? [],
        isGast: (id) => !!profiles[id]?.is_guest,
      })
    : "geen-deelnemer";

  // Niets te zien en niets te doen: dan hoort hier geen blok te staan.
  if (m.status !== "completed") return null;
  if (
    !zaak &&
    (blokkade === "geen-deelnemer" ||
      blokkade === "venster-dicht" ||
      blokkade === "geen-uitslag" ||
      blokkade === "geen-punt-te-halen" ||
      blokkade === "geen-stemmers")
  ) {
    return null;
  }

  const kiezers = loopt
    ? stemgerechtigden({
        match: m,
        teams,
        claimantId: loopt.claimant_id,
        isGast: (id) => !!profiles[id]?.is_guest,
      })
    : [];
  const stand = stemStand(votes.data ?? [], kiezers);
  const ikStemMee = !!myId && kiezers.includes(myId);
  const alGestemd = !!myId && (votes.data ?? []).some((v) => v.voter_id === myId);

  // Voorbeeld van de correctie: wat er met de stand gebeurt als dit doorgaat.
  const kantKlager = zaak ? kantVan(m, teams, zaak.claimant_id) : null;
  const zaakNa =
    zaak && kantKlager
      ? naCorrectie({
          match: m,
          kant: kantKlager,
          setNumber: zaak.set_number,
          sets,
        })
      : null;

  const mijnKant = myId ? kantVan(m, teams, myId) : null;
  const mijnNa = mijnKant
    ? naCorrectie({
        match: m,
        kant: mijnKant,
        setNumber: sets ? setNr : null,
        sets,
      })
    : null;

  async function dienIn() {
    if (busy || !myId) return;
    setBusy(true);
    try {
      await createAppeal({
        matchId: m.id,
        claimantId: myId,
        reden,
        setNumber: sets ? setNr : null,
        toelichting,
      });
      tap();
      toast.success("Beroep aangetekend. Nu is het aan de rest.");
      setOpen(false);
      setToelichting("");
      appeals.reload();
      eigen.reload();
      onChanged?.();
    } catch (err) {
      toast.error(appealFoutMelding(err));
    } finally {
      setBusy(false);
    }
  }

  async function stem(akkoord: boolean) {
    if (busy || !myId || !loopt) return;
    setBusy(true);
    try {
      await castAppealVote({ appealId: loopt.id, voterId: myId, akkoord });
      tap();
      toast.success(akkoord ? "Genoteerd: klopt." : "Genoteerd: onzin.");
      appeals.reload();
      votes.reload();
      onChanged?.();
    } catch (err) {
      toast.error(appealFoutMelding(err));
    } finally {
      setBusy(false);
    }
  }

  const statusTekst: Record<PointAppeal["status"], string> = {
    open: `${stand.voor} voor · ${stand.tegen} tegen · nog ${stand.open} te gaan`,
    toegekend: "toegekend — het punt is verschoven",
    afgewezen: "afgewezen — de uitslag blijft staan",
    verlopen: "vervallen — de uitslag was intussen al gewijzigd",
    "tegoed-op": "gelijk gekregen, maar het VAR-tegoed was op",
  };

  // Rudy spreekt pas als de zaak beslist is. Bij een toekenning is de uitslag
  // al gecorrigeerd, dus of de winnaar omdraaide lezen we aan het beroep: de
  // snapshot is de stand van vóór de correctie.
  const winnaarDraaideOm =
    uitkomst === "toegekend" && zaak
      ? (zaak.snapshot_a > zaak.snapshot_b) !==
        ((m.score_a ?? 0) > (m.score_b ?? 0))
      : false;
  const uitspraak =
    uitkomst && zaak
      ? varUitspraak({
          appealId: zaak.id,
          status: uitkomst,
          winnaarDraaitOm: winnaarDraaideOm,
          ctx: roastCtx(group, profiles[zaak.claimant_id]),
        })
      : null;

  return (
    <section className="varblok" aria-label="Rudy's VAR">
      <header className="varblok__head">
        <span className="varblok__naam">
          <span aria-hidden="true">📺</span> VAR
        </span>
        {zaak && (
          <span className="varblok__stat">{statusTekst[zaak.status]}</span>
        )}
      </header>

      {zaak && (
        <>
          <p className="varblok__claim">
            <strong>{naam(zaak.claimant_id)}</strong> betwist één punt:{" "}
            {REDENEN.find((r) => r.id === zaak.reden)?.label ?? zaak.reden}
            {zaak.set_number != null && ` (set ${zaak.set_number})`}.
            {zaak.toelichting && <em> “{zaak.toelichting}”</em>}
          </p>

          {zaakNa && (
            <p className="varblok__score">
              <span className="varblok__score-oud">
                {zaak.snapshot_a} – {zaak.snapshot_b}
              </span>
              <span aria-hidden="true"> ▸ </span>
              <span className="varblok__score-nieuw">
                {zaakNa.scoreA} – {zaakNa.scoreB}
              </span>
              {zaak.status === "open" && draaitWinnaarOm(m, zaakNa) && (
                <span className="varblok__waarschuwing">
                  {" "}
                  — dit draait de winnaar om
                </span>
              )}
            </p>
          )}

          {/* De uitspraak zelf. De tekst draagt hem — de fluit is versiering,
              en wie hem niet wil dempt hem hier. */}
          {uitspraak && (
            <div className="varblok__uitspraak">
              <p className="varblok__rudy">
                <span aria-hidden="true">🎙️</span> {uitspraak}
              </p>
              <button
                type="button"
                className="varblok__demp"
                aria-pressed={muted}
                onClick={toggleMute}
                title={
                  muted
                    ? "Fluitsignaal weer aanzetten"
                    : "Fluitsignaal dempen"
                }
              >
                {muted ? "🔇" : "🔊"}
                <span className="sr-only">
                  {muted ? "Fluitsignaal aanzetten" : "Fluitsignaal dempen"}
                </span>
              </button>
            </div>
          )}

          {(votes.data ?? []).length > 0 && (
            <ul className="varblok__stemmen">
              {(votes.data ?? []).map((v) => (
                <li key={v.voter_id}>
                  <span className="varblok__stemmer">{naam(v.voter_id)}</span>
                  <span
                    className={`varblok__stem ${
                      v.akkoord ? "is-voor" : "is-tegen"
                    }`}
                  >
                    {v.akkoord ? "Klopt" : "Onzin"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {loopt && ikStemMee && !alGestemd && (
            <div className="varblok__acties">
              <button
                type="button"
                className="varblok__knop varblok__knop--voor"
                disabled={busy}
                onClick={() => stem(true)}
              >
                Klopt
              </button>
              <button
                type="button"
                className="varblok__knop varblok__knop--tegen"
                disabled={busy}
                onClick={() => stem(false)}
              >
                Onzin
              </button>
            </div>
          )}
        </>
      )}

      {!zaak && blokkade === null && !open && (
        <button
          type="button"
          className="varblok__knop"
          disabled={busy}
          onClick={() => setOpen(true)}
        >
          Punt betwisten
        </button>
      )}

      {!zaak && blokkade === null && open && (
        <div className="varblok__form">
          <div className="varblok__redenen" role="group" aria-label="Reden">
            {REDENEN.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`varblok__chip${reden === r.id ? " is-actief" : ""}`}
                aria-pressed={reden === r.id}
                onClick={() => setReden(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          {sets && sets.length > 1 && (
            <label className="varblok__veld">
              In welke set?
              <select
                value={setNr}
                onChange={(e) => setSetNr(Number(e.target.value))}
              >
                {sets.map(([a, b], i) => (
                  <option key={i} value={i + 1}>
                    Set {i + 1} ({a}-{b})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="varblok__veld">
            Eén zin erbij (optioneel)
            <input
              type="text"
              maxLength={TOELICHTING_MAX}
              value={toelichting}
              placeholder="Die bal was echt binnen."
              onChange={(e) => setToelichting(e.target.value)}
            />
          </label>

          {mijnNa && (
            <p className="varblok__score">
              Wordt dit toegekend:{" "}
              <span className="varblok__score-oud">
                {m.score_a} – {m.score_b}
              </span>
              <span aria-hidden="true"> ▸ </span>
              <span className="varblok__score-nieuw">
                {mijnNa.scoreA} – {mijnNa.scoreB}
              </span>
              {draaitWinnaarOm(m, mijnNa) && (
                <span className="varblok__waarschuwing">
                  {" "}
                  — dit draait de winnaar om
                </span>
              )}
            </p>
          )}

          <div className="varblok__acties">
            <button
              type="button"
              className="varblok__knop varblok__knop--vol"
              disabled={busy}
              onClick={dienIn}
            >
              {busy ? "Bezig…" : "Beroep aantekenen"}
            </button>
            <button
              type="button"
              className="varblok__knop"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      <p className="varblok__foot">
        {blokkade && blokkade !== "geen-deelnemer"
          ? blokkadeUitleg(blokkade)
          : loopt
            ? "Een meerderheid van de andere spelers beslist. Wie zwijgt, stemt niet mee."
            : "Eén punt, één beroep per match, één toekenning per speeldag."}
      </p>
    </section>
  );
}

export default VarBlock;
