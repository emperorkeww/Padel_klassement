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
  /** Sta je standaard in de indeling? Dat is zo als je "ik kan" stemde: die
   *  lijst is de basis waarmee MakeTeams begint (#1308). Zonder dat gegeven
   *  ging deze hook ervan uit dat iedereen meedeed, en bood het sheet "Ik kan
   *  toch niet" aan iemand die er helemaal niet bij stond. */
  standaardMee: boolean,
) {
  const toast = useToast();
  // De afwijking uit de database: true = handmatig toegevoegd, false =
  // afgemeld, null = volg de stemming.
  const [afwijking, setAfwijking] = useState<boolean | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    let levend = true;
    void getAanwezigheid(optionId)
      .then((k) => {
        if (levend) setAfwijking(k[myId] ?? null);
      })
      .catch(() => {
        /* onbekend: dan blijft de stemming de bron */
      });
    return () => {
      levend = false;
    };
  }, [optionId, myId]);

  useRealtime(
    "play_poll_presence",
    () => {
      void getAanwezigheid(optionId).then((k) => setAfwijking(k[myId] ?? null));
    },
    `option_id=eq.${optionId}`,
  );

  const mee = afwijking ?? standaardMee;

  /** Omzetten; optimistisch, met terugdraaien als de server nee zegt. */
  async function zet() {
    const volgende = !mee;
    // Valt je keuze samen met wat de stemming al zegt, dan hoort er geen rij te
    // blijven staan: `null` betekent "volg de stemming".
    const nieuw = volgende === standaardMee ? null : volgende;
    const vorige = afwijking;
    setBezig(true);
    setAfwijking(nieuw);
    try {
      await zetMijnAanwezigheid(optionId, groupId, myId, nieuw);
      toast.success(
        volgende
          ? "Je doet mee — de groep ziet het."
          : "Afgemeld — de groep ziet het.",
      );
    } catch (err) {
      setAfwijking(vorige);
      toast.error(errorMessage(err));
    } finally {
      setBezig(false);
    }
  }

  return { mee, bezig, zet };
}
