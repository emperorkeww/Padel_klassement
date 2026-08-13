import { useEffect, useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { errorMessage } from "@/lib/utils/errors";
import {
  getAanwezigheid,
  zetMijnAanwezigheid,
} from "@/features/groups/aanwezigheidApi";

/**
 * Kom ik naar deze vastgelegde speeldag? (#1271, gedeeld sinds #1308)
 *
 * Stemmen kan alleen zolang de poll open is; wie ná het vastleggen afhaakt,
 * schrijft een afwijking naar `play_poll_presence` — dezelfde bron waaruit de
 * indeling put. Geen rij betekent "volg de stemming".
 *
 * Stond inline in de speeldagkaart. Het agenda-dag-sheet toont dezelfde
 * geboekte speeldag en had er helemaal geen handeling bij: het meldde "Nog 2
 * bevestigde spelers nodig" zonder enige manier om die speler te worden.
 */
export function useAanwezigheid(
  optionId: string,
  groupId: string,
  myId: string,
) {
  const toast = useToast();
  const [ikKomNiet, setIkKomNiet] = useState(false);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    let levend = true;
    void getAanwezigheid(optionId)
      .then((k) => {
        if (levend) setIkKomNiet(k[myId] === false);
      })
      .catch(() => {
        /* onbekend blijft "ik doe mee": de stemming is de bron */
      });
    return () => {
      levend = false;
    };
  }, [optionId, myId]);

  useRealtime(
    "play_poll_presence",
    () => {
      void getAanwezigheid(optionId).then((k) => setIkKomNiet(k[myId] === false));
    },
    `option_id=eq.${optionId}`,
  );

  /** Omzetten; optimistisch, met terugdraaien als de server nee zegt. */
  async function zet() {
    const volgende = !ikKomNiet;
    setBezig(true);
    setIkKomNiet(volgende);
    try {
      await zetMijnAanwezigheid(optionId, groupId, myId, volgende ? false : null);
      toast.success(
        volgende ? "Afgemeld — de groep ziet het." : "Je doet weer mee.",
      );
    } catch (err) {
      setIkKomNiet(!volgende);
      toast.error(errorMessage(err));
    } finally {
      setBezig(false);
    }
  }

  return { ikKomNiet, bezig, zet };
}
