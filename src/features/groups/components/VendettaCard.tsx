// Vendetta-kaart (#169): de verklaarde aartsrivaliteiten van de groep als
// lopende verhaallijn — race-balken naar het seizoensdoel, tussenstand, een
// taunt na het laatste duel en een revanche-aankondiging. Het contract komt
// uit vendettas (realtime); de stand is client-side uit de groepsmatches.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { displayName } from "@/features/profiles/api";
import { nextEncounter } from "@/features/groups/rivalry";
import { roastSeed } from "@/features/coach/roastTone";
import { errorMessage } from "@/lib/utils/errors";
import { formatDate, formatRelativeDay, formatTime } from "@/lib/utils/format";
import { tap } from "@/lib/utils/haptics";
import {
  vendettaKop,
  vendettaStand,
  vendettaTaunt,
} from "../vendetta";
import {
  endVendetta,
  getGroupVendettas,
  startVendetta,
  type Vendetta,
} from "../vendettaApi";
import { ShareVendetta } from "./ShareVendetta";
import type { Group, GroupMember, Match, Profile, Team } from "@/types";
import "./VendettaCard.css";

const DOELEN = [3, 5, 7] as const;

export function VendettaCard({
  group,
  matches,
  teams,
  profiles,
  memberList,
  myId,
}: {
  group: Group;
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  memberList: GroupMember[];
  myId: string;
}) {
  const vendettas = useAsync(() => getGroupVendettas(group.id), [group.id]);
  useRealtime("vendettas", vendettas.reload, `group_id=eq.${group.id}`);

  const actief = (vendettas.data ?? []).filter((v) => v.status === "active");
  const isMember = memberList.some((m) => m.player_id === myId);
  // Rivalen zonder al lopende vendetta met mij (de unieke index weigert de
  // rest serverzijdig toch; dit houdt de keuzelijst gewoon eerlijk).
  const beschikbaar = memberList.filter(
    (m) =>
      m.player_id !== myId &&
      !actief.some(
        (v) =>
          (v.challenger_id === myId && v.rival_id === m.player_id) ||
          (v.rival_id === myId && v.challenger_id === m.player_id),
      ),
  );

  const [starten, setStarten] = useState(false);

  if (actief.length === 0 && !isMember) return null;

  return (
    <section className="card vendetta-card">
      <div className="card__head">
        <h2 className="card__title">⚔️ Vendetta's</h2>
        {isMember && !starten && beschikbaar.length > 0 && (
          <button className="btn btn--sm" onClick={() => setStarten(true)}>
            ⚔️ Verklaar vendetta
          </button>
        )}
      </div>

      {actief.length === 0 && !starten && (
        <p className="empty">
          Nog geen actieve vendetta. Verklaar een aartsrivaal en maak van jullie
          onderlinge duels een seizoen — eerste tot 3, 5 of 7 overwinningen.
        </p>
      )}

      {starten && (
        <StartVendetta
          groupId={group.id}
          myId={myId}
          kandidaten={beschikbaar}
          profiles={profiles}
          onDone={() => {
            setStarten(false);
            vendettas.reload();
          }}
          onCancel={() => setStarten(false)}
        />
      )}

      {actief.map((v) => (
        <VendettaItem
          key={v.id}
          vendetta={v}
          group={group}
          matches={matches}
          teams={teams}
          profiles={profiles}
          myId={myId}
          onChanged={vendettas.reload}
        />
      ))}
    </section>
  );
}

/** Startflow: rivaal kiezen uit de groep + seizoensdoel (3/5/7 zeges). */
function StartVendetta({
  groupId,
  myId,
  kandidaten,
  profiles,
  onDone,
  onCancel,
}: {
  groupId: string;
  myId: string;
  kandidaten: GroupMember[];
  profiles: Record<string, Profile>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [rivalId, setRivalId] = useState("");
  const [doel, setDoel] = useState<(typeof DOELEN)[number]>(5);
  const [busy, setBusy] = useState(false);

  async function verklaar() {
    if (!rivalId) return toast.error("Kies eerst je aartsrivaal.");
    setBusy(true);
    try {
      await startVendetta({
        groupId,
        challengerId: myId,
        rivalId,
        targetWins: doel,
      });
      tap();
      toast.success("Vendetta verklaard! ⚔️");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vendetta-start">
      <label className="vendetta-start__field">
        <span>Je aartsrivaal</span>
        <select
          className="select"
          value={rivalId}
          onChange={(e) => setRivalId(e.target.value)}
        >
          <option value="">Kies een groepsgenoot…</option>
          {kandidaten.map((m) => (
            <option key={m.player_id} value={m.player_id}>
              {displayName(profiles[m.player_id])}
            </option>
          ))}
        </select>
      </label>
      <div className="vendetta-start__doel">
        <span>Eerste tot</span>
        <div className="tabs" role="group" aria-label="Seizoensdoel">
          {DOELEN.map((d) => (
            <button
              key={d}
              className={`tab ${doel === d ? "is-active" : ""}`}
              onClick={() => setDoel(d)}
            >
              {d} zeges
            </button>
          ))}
        </div>
      </div>
      <div className="vendetta-start__buttons">
        <button className="btn btn--sm" onClick={onCancel} disabled={busy}>
          Annuleren
        </button>
        <button
          className="btn btn--primary btn--sm"
          onClick={verklaar}
          disabled={busy || !rivalId}
        >
          {busy ? "Verklaren…" : "Verklaar ⚔️"}
        </button>
      </div>
    </div>
  );
}

function VendettaItem({
  vendetta: v,
  group,
  matches,
  teams,
  profiles,
  myId,
  onChanged,
}: {
  vendetta: Vendetta;
  group: Group;
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  myId: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const stand = useMemo(
    () => vendettaStand(v, matches, teams),
    [v, matches, teams],
  );
  const revanche = useMemo(
    () =>
      stand.beslist
        ? null
        : nextEncounter(matches, teams, v.challenger_id, v.rival_id),
    [matches, teams, v, stand.beslist],
  );

  const naam = (id: string) => displayName(profiles[id]);
  const betrokken = myId === v.challenger_id || myId === v.rival_id;

  // Taunt bij het laatste gewonnen duel — deterministisch per duel, zodat de
  // hele groep dezelfde ziet. Schild van de verliezer aan → geen taunt.
  const taunt = useMemo(() => {
    const laatste = stand.laatste;
    if (!laatste || laatste.winnerId === null || stand.beslist) return null;
    const winnaar = laatste.winnerId;
    const verliezer =
      winnaar === v.challenger_id ? v.rival_id : v.challenger_id;
    if (profiles[verliezer]?.roast_schild) return null;
    const w =
      winnaar === v.challenger_id ? stand.winsChallenger : stand.winsRival;
    const l =
      winnaar === v.challenger_id ? stand.winsRival : stand.winsChallenger;
    return vendettaTaunt({
      winnaar: naam(winnaar),
      verliezer: naam(verliezer),
      stand: `${w}–${l}`,
      intensiteit: group.roast_intensiteit ?? "gemeen",
      seed: roastSeed(v.id, laatste.match.id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand, v, profiles, group.roast_intensiteit]);

  async function beeindig() {
    setBusy(true);
    try {
      await endVendetta(v.id);
      tap();
      toast.success("Vendetta beëindigd.");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const revancheWanneer = revanche?.played_at
    ? `${formatRelativeDay(revanche.played_at)} om ${formatTime(revanche.played_at)}`
    : null;

  return (
    <article className="vendetta">
      <div className="vendetta__head">
        <Link className="vendetta__player" to={`/spelers/${v.challenger_id}`}>
          <Avatar profile={profiles[v.challenger_id]} size={32} />
          <span className="vendetta__name">{naam(v.challenger_id)}</span>
        </Link>
        <span className="vendetta__score num">
          {stand.winsChallenger}–{stand.winsRival}
        </span>
        <Link
          className="vendetta__player vendetta__player--right"
          to={`/spelers/${v.rival_id}`}
        >
          <Avatar profile={profiles[v.rival_id]} size={32} />
          <span className="vendetta__name">{naam(v.rival_id)}</span>
        </Link>
      </div>

      <div className="vendetta__race">
        {[
          { id: v.challenger_id, wins: stand.winsChallenger },
          { id: v.rival_id, wins: stand.winsRival },
        ].map((r) => (
          <div key={r.id} className="vendetta__baan">
            <span className="vendetta__baan-naam">{naam(r.id)}</span>
            <div
              className="vendetta__bar"
              role="progressbar"
              aria-label={`${naam(r.id)}: ${r.wins} van ${v.target_wins} zeges`}
              aria-valuemin={0}
              aria-valuemax={v.target_wins}
              aria-valuenow={r.wins}
            >
              <div
                className={`vendetta__bar-fill ${stand.beslist?.winnaarId === r.id ? "is-winnaar" : ""}`}
                style={{
                  width: `${Math.min(100, (r.wins / v.target_wins) * 100)}%`,
                }}
              />
            </div>
            <span className="vendetta__baan-score num">
              {r.wins}/{v.target_wins}
            </span>
          </div>
        ))}
      </div>

      {stand.beslist ? (
        <>
          <p className="vendetta__beslist" role="status">
            🏆 <strong>{naam(stand.beslist.winnaarId)}</strong> wint het
            vendetta-seizoen! Eindstand {stand.winsChallenger}–{stand.winsRival}.
          </p>
          <p className="vendetta__share">
            <ShareVendetta
              vendettaId={v.id}
              winnaar={naam(stand.beslist.winnaarId)}
              verliezer={naam(
                stand.beslist.winnaarId === v.challenger_id
                  ? v.rival_id
                  : v.challenger_id,
              )}
              stand={
                stand.beslist.winnaarId === v.challenger_id
                  ? `${stand.winsChallenger}–${stand.winsRival}`
                  : `${stand.winsRival}–${stand.winsChallenger}`
              }
              groupName={group.name}
              doel={v.target_wins}
            />
          </p>
        </>
      ) : (
        <p className="vendetta__kop">{vendettaKop(stand, v, naam)}</p>
      )}

      {taunt && <p className="vendetta__taunt">🎙️ {taunt}</p>}

      {revanche && (
        <p className="vendetta__revanche">
          🥊 {revancheWanneer ? `Revanche ${revancheWanneer}` : "Revanche gepland"}
        </p>
      )}

      <div className="vendetta__foot">
        <span className="vendetta__meta">
          Sinds {formatDate(v.started_at)} · eerste tot {v.target_wins} zeges
          {stand.draws > 0 ? ` · ${stand.draws} gelijk` : ""}
        </span>
        {betrokken && (
          <button
            className="btn btn--sm vendetta__end"
            onClick={beeindig}
            disabled={busy}
          >
            {busy
              ? "Beëindigen…"
              : stand.beslist
                ? "Seizoen afsluiten"
                : "Beëindigen"}
          </button>
        )}
      </div>
    </article>
  );
}

export default VendettaCard;
