import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { useToast } from "@/ui/ToastProvider";
import { useConfirm } from "@/ui/ConfirmDialog";
import { displayName } from "@/features/profiles/api";
import { errorMessage } from "@/lib/utils/errors";
import {
  addGroupMembers,
  removeGroupMember,
  renameGroup,
  setRoastIntensiteit,
  deleteGroup,
  leaveGroup,
  createGroupInvite,
} from "../api";
import { createGuestPlayer } from "@/features/matches/api";
import type { ZwartePietHolder } from "../zwartePietApi";
import type { Group, GroupMember, Profile, RoastIntensiteit } from "@/types";

interface GroupLedenTabProps {
  groupId: string;
  myId: string;
  isOwner: boolean;
  busy: boolean;
  act: (fn: () => Promise<unknown>, ok: string) => void;
  memberList: GroupMember[];
  profiles: Record<string, Profile>;
  zwartePiet: ZwartePietHolder | null;
  group: Group;
  reloadGroup: () => void;
  addableFriendIds: string[];
}

export function GroupLedenTab({
  groupId,
  myId,
  isOwner,
  busy,
  act,
  memberList,
  profiles,
  zwartePiet,
  group,
  reloadGroup,
  addableFriendIds,
}: GroupLedenTabProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  // Meervoudige selectie voor "voeg vrienden toe" + deelbare uitnodigingslink.
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [guestName, setGuestName] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  // Hernoem-veld volgt de geladen groepsnaam.
  const [renameValue, setRenameValue] = useState("");
  useEffect(() => {
    if (group) setRenameValue(group.name);
  }, [group]);

  function toggleSelected(pid: string) {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  async function makeInvite() {
    setInviteBusy(true);
    try {
      const token = await createGroupInvite(groupId);
      const url = `${window.location.origin}/groepen/join/${token}`;
      setInviteUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Uitnodigingslink gekopieerd.");
      } catch {
        toast.success("Uitnodigingslink klaar — kopieer 'm hieronder.");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card__title">Leden</h2>
      <div className="person-list">
        {memberList.map((m) => (
          <div key={m.player_id} className="person-row">
            <span className="cell-player">
              <Avatar profile={profiles[m.player_id]} size={28} />
              {displayName(profiles[m.player_id])}{" "}
              {m.role === "owner" && (
                <span className="badge badge--accent">eigenaar</span>
              )}
              {zwartePiet?.holderId === m.player_id && (
                <span className="badge badge--loss" title="Draagt de Zwarte Piet">
                  🃏
                </span>
              )}
            </span>
            {isOwner && m.player_id !== myId && (
              <button
                className="btn btn--danger btn--sm"
                disabled={busy}
                onClick={async () => {
                  if (
                    !(await confirm({
                      title: "Lid verwijderen?",
                      body: `${displayName(profiles[m.player_id])} wordt uit deze groep verwijderd.`,
                      confirmLabel: "Verwijderen",
                      danger: true,
                    }))
                  )
                    return;
                  act(
                    () => removeGroupMember(groupId, m.player_id),
                    "Lid verwijderd.",
                  );
                }}
              >
                Verwijderen
              </button>
            )}
          </div>
        ))}
      </div>

      {isOwner && (
        <>
          <h3 className="card__title card__title--section">
            Vrienden toevoegen
          </h3>
          {addableFriendIds.length === 0 ? (
            <p className="empty">
              Geen vrienden om toe te voegen. Voeg eerst vrienden toe.
            </p>
          ) : (
            <>
              <div className="person-list">
                {addableFriendIds.map((pid) => (
                  <label key={pid} className="person-row person-row--pick">
                    <span className="cell-player">
                      <input
                        type="checkbox"
                        className="member-check"
                        checked={selectedToAdd.has(pid)}
                        onChange={() => toggleSelected(pid)}
                      />
                      <Avatar profile={profiles[pid]} size={28} />
                      {displayName(profiles[pid])}
                    </span>
                  </label>
                ))}
              </div>
              <div className="form-actions">
                <button
                  className="btn btn--primary btn--sm"
                  disabled={busy || selectedToAdd.size === 0}
                  onClick={() =>
                    act(async () => {
                      await addGroupMembers(groupId, [...selectedToAdd]);
                      setSelectedToAdd(new Set());
                    }, "Leden toegevoegd.")
                  }
                >
                  {selectedToAdd.size <= 1
                    ? "Voeg toe"
                    : `Voeg ${selectedToAdd.size} toe`}
                </button>
              </div>
            </>
          )}

          <h3 className="card__title card__title--section">
            Gast toevoegen
          </h3>
          <p className="card__subtitle">
            Speelt er iemand zonder account mee? Voeg 'm als gast toe met een
            naam; hij telt mee in gegenereerde rondes.
          </p>
          <div className="guest-add">
            <input
              className="input guest-add__input"
              type="text"
              placeholder="Naam van de gast…"
              aria-label="Naam van een gastspeler"
              value={guestName}
              maxLength={40}
              disabled={busy}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && guestName.trim()) {
                  e.preventDefault();
                  const naam = guestName.trim();
                  void act(async () => {
                    const gid = await createGuestPlayer(naam);
                    await addGroupMembers(groupId, [gid]);
                    setGuestName("");
                  }, "Gast toegevoegd.");
                }
              }}
            />
            <button
              className="btn btn--primary btn--sm"
              disabled={busy || !guestName.trim()}
              onClick={() => {
                const naam = guestName.trim();
                void act(async () => {
                  const gid = await createGuestPlayer(naam);
                  await addGroupMembers(groupId, [gid]);
                  setGuestName("");
                }, "Gast toegevoegd.");
              }}
            >
              + Gast
            </button>
          </div>

          <h3 className="card__title card__title--section">
            Uitnodigingslink
          </h3>
          <p className="card__subtitle">
            Deel deze link; wie 'm opent en ingelogd is, wordt automatisch
            lid — ook zonder vriendschap.
          </p>
          <div className="form-actions">
            <button
              className="btn btn--sm"
              disabled={inviteBusy}
              onClick={makeInvite}
            >
              {inviteBusy ? "Bezig…" : "Maak uitnodigingslink"}
            </button>
          </div>
          {inviteUrl && (
            <input
              className="input invite-url"
              aria-label="Uitnodigingslink"
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
        </>
      )}

      <h3 className="card__title card__title--section">Groep beheren</h3>
      {isOwner ? (
        <div className="stack">
          <form
            className="row-between"
            onSubmit={(e) => {
              e.preventDefault();
              const name = renameValue.trim();
              if (!name || name === group.name) return;
              act(() => renameGroup(groupId, name), "Groepsnaam bijgewerkt.");
            }}
          >
            <input
              className="input"
              aria-label="Groepsnaam"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <button
              className="btn btn--sm"
              disabled={
                busy ||
                !renameValue.trim() ||
                renameValue.trim() === group.name
              }
            >
              Hernoemen
            </button>
          </form>
          <div className="stack">
            <div className="row-between">
              <span>Roast-intensiteit 🎙️</span>
              <select
                className="select"
                aria-label="Roast-intensiteit"
                disabled={busy}
                value={group.roast_intensiteit ?? "gemeen"}
                onChange={(e) => {
                  const val = e.target.value as RoastIntensiteit;
                  act(async () => {
                    await setRoastIntensiteit(groupId, val);
                    reloadGroup();
                  }, "Roast-intensiteit bijgewerkt.");
                }}
              >
                <option value="mild">Mild — zachte por</option>
                <option value="gemeen">Gemeen — standaard</option>
                <option value="radioactief">Geen genade — meedogenloos</option>
              </select>
            </div>
            <p className="field-hint">
              Hoe hard het systeem de leden van deze groep roast. Spelers met
              een roast-schild blijven altijd gespaard.
            </p>
          </div>
          <div>
            <button
              className="btn btn--danger btn--sm"
              disabled={busy}
              onClick={async () => {
                if (
                  !(await confirm({
                    title: "Groep verwijderen?",
                    body: "Deze groep en al zijn wedstrijden worden verwijderd. Dit kan niet ongedaan worden gemaakt.",
                    confirmLabel: "Verwijderen",
                    danger: true,
                  }))
                )
                  return;
                act(async () => {
                  await deleteGroup(groupId);
                  navigate("/groepen", { replace: true });
                }, "Groep verwijderd.");
              }}
            >
              Groep verwijderen
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            className="btn btn--danger btn--sm"
            disabled={busy}
            onClick={async () => {
              if (
                !(await confirm({
                  title: "Groep verlaten?",
                  body: "Je verlaat deze groep. Je kunt later opnieuw uitgenodigd worden.",
                  confirmLabel: "Verlaten",
                  danger: true,
                }))
              )
                return;
              act(async () => {
                await leaveGroup(groupId, myId);
                navigate("/groepen", { replace: true });
              }, "Je hebt de groep verlaten.");
            }}
          >
            Groep verlaten
          </button>
        </div>
      )}
      {confirmUi}
    </section>
  );
}
