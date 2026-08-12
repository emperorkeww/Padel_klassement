import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/ui/ToastProvider";
import { tap } from "@/lib/utils/haptics";
import { errorMessage } from "@/lib/utils/errors";
import { longDay, shortDay } from "@/features/groups/planPollHelpers";
import { StemRij } from "@/features/groups/components/StemRij";
import {
  clearPollVote,
  pollSharePath,
  setPollVote,
  type PollVoteStatus,
} from "@/features/groups/pollsApi";
import { kiesStemMomenten, sluitTekst, type StemMoment } from "../stemMomenten";
import type { OpenPollBundle } from "../dashboardHelpers";
import "./StemKaart.css";

/**
 * Stemmen op de eerstvolgende speeldagen, vanaf het overzicht (#1196).
 *
 * Vervangt de "Stem nu"-banner, die één zin toonde en je wegstuurde naar de
 * speeldagpagina. De vraag is kort — kan jij donderdag? — dus hoort het
 * antwoord hier te passen. Welke momenten er staan bepaalt kiesStemMomenten;
 * de data komt uit loadOpenPolls, dat het overzicht toch al ophaalt.
 *
 * De rijen blijven staan nadat je gestemd hebt. Een kaart die verdwijnt onder
 * de vinger waarmee je er net op tikte laat je twijfelen of het gelukt is, en
 * je moet je keuze kunnen herzien.
 */
export function StemKaart({
  bundles,
  myId,
  onGestemd,
  now = Date.now(),
}: {
  bundles: OpenPollBundle[];
  myId: string;
  /** Stem geland: het overzicht mag zijn polls opnieuw laden. Realtime doet dit
   *  normaal zelf, maar zonder verbinding blijft de telling anders staan. */
  onGestemd?: () => void;
  now?: number;
}) {
  const toast = useToast();
  // Optimistisch stemmen: je tik is meteen zichtbaar, de server volgt. Zelfde
  // patroon als het dag-sheet van de agenda.
  const [overlay, setOverlay] = useState<Map<string, PollVoteStatus | null>>(
    new Map(),
  );

  const data = kiesStemMomenten(bundles, myId, now);
  if (!data) return null;

  const stemVan = (m: StemMoment): PollVoteStatus | null =>
    overlay.has(m.optionId) ? (overlay.get(m.optionId) ?? null) : m.mijnStem;

  /** Stem zetten of wissen; opnieuw tikken op je eigen keuze haalt hem weg. */
  function stem(m: StemMoment, status: PollVoteStatus) {
    const vorige = stemVan(m);
    const volgende = vorige === status ? null : status;
    setOverlay((cur) => new Map(cur).set(m.optionId, volgende));
    tap();
    const call =
      volgende === null
        ? clearPollVote(m.optionId, myId)
        : setPollVote(m.optionId, m.groupId, myId, volgende);
    call.then(() => onGestemd?.()).catch((err) => {
      setOverlay((cur) => new Map(cur).set(m.optionId, vorige));
      toast.error(errorMessage(err));
    });
  }

  const groep = data.momenten[0].groupName;
  const sluit = sluitTekst(data.sluitMs, now);

  return (
    <section className="card stemkaart" aria-labelledby="stemkaart-titel">
      <div className="card__head">
        <h2
          className="card__title card__title--tight"
          id="stemkaart-titel"
        >
          🗳️ {data.alGestemd ? "Je stem staat genoteerd" : "Wanneer kan jij?"}
          {!data.meerdereGroepen && ` · ${groep}`}
        </h2>
      </div>

      <div className="stemkaart__rijen">
        {data.momenten.map((m) => (
          <StemRij
            key={m.optionId}
            titel={`${shortDay(m.date)} · ${m.startTime}`}
            bijschrift={data.meerdereGroepen ? m.groupName : undefined}
            omschrijving={`${longDay(m.date)} ${m.startTime}${
              data.meerdereGroepen ? ` — ${m.groupName}` : ""
            }`}
            aantal={m.jaAantal || null}
            mine={stemVan(m)}
            onVote={(s) => stem(m, s)}
          />
        ))}
      </div>

      <p className="stemkaart__voet">
        {sluit && <span className="stemkaart__sluit">{sluit}</span>}
        <Link
          className="btn btn--sm"
          to={data.pollId ? pollSharePath(data.pollId) : "/agenda"}
        >
          {data.pollId ? "Bekijk de speeldag →" : "Naar de agenda →"}
        </Link>
      </p>
    </section>
  );
}

export default StemKaart;
