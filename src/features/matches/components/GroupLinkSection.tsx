import { useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { tap } from "@/lib/utils/haptics";
import { setMatchGroup } from "@/features/matches/api";
import { getMyGroups } from "@/features/groups/api";
import type { Match } from "@/types";

/**
 * Groep koppelen (#648): een losse match alsnog aan een groep hangen, of een
 * groepsmatch verhangen/loskoppelen. Zichtbaar voor elk lid van de doelgroep
 * (losse match: iedereen met minstens één eigen groep; groepsmatch: alleen
 * leden van de huidige groep). De RPC set_match_group dwingt dit ook af.
 *
 * Uitgesneden uit MatchDetail in #1144, gedrag ongewijzigd.
 */
export function GroupLinkSection({
  match: m,
  onSaved,
}: {
  match: Match;
  onSaved: () => void;
}) {
  const toast = useToast();
  const myGroups = useAsync(getMyGroups, []);
  const [picked, setPicked] = useState(m.group_id ?? "");
  const [busy, setBusy] = useState(false);

  const groups = myGroups.data ?? [];
  const isLos = m.group_id == null;
  // Verhangen/loskoppelen kan alleen als lid van de huidige groep; de eigen
  // groepenlijst is daarvoor meteen de lidmaatschapscheck.
  const magWijzigen = !isLos && groups.some((g) => g.id === m.group_id);
  if (myGroups.loading || (isLos ? groups.length === 0 : !magWijzigen))
    return null;

  const unchanged = picked === (m.group_id ?? "");

  async function save() {
    setBusy(true);
    try {
      await setMatchGroup(m.id, picked || null);
      tap();
      toast.success(
        picked ? "Match aan groep gekoppeld." : "Match losgekoppeld.",
      );
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <p className="md-toto__note">
        {isLos
          ? "Losse match — telt nergens mee. Koppel hem aan een groep zodat hij meetelt voor de groepsstand."
          : "Verhang deze match naar een andere groep, of maak er weer een losse match van."}
      </p>
      <label className="label">
        {isLos ? "Koppel aan groep" : "Groep"}
        <select
          className="select"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
        >
          <option value="">Losse match — geen groep</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <div className="md-editor__buttons">
        <button
          className="btn btn--primary btn--sm"
          onClick={save}
          disabled={busy || unchanged}
        >
          {busy ? "Opslaan…" : "Groep opslaan"}
        </button>
      </div>
    </section>
  );
}

export default GroupLinkSection;
