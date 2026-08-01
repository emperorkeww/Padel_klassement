import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { useToast } from "@/ui/ToastProvider";
import { BallIcon } from "@/ui/BallIcon";
import { InviteSkeleton } from "@/ui/Skeleton";
import { getProfilesByIds } from "@/features/profiles/api";
import {
  previewGroupInvite,
  redeemGroupInvite,
  type InvitePreview,
} from "./api";
import { ledenLabel } from "./groepHelpers";
import { MemberStack } from "./components/MemberStack";
import {
  UITNODIGING_TEKST,
  uitnodigingProbleem,
  vervalTekst,
  type UitnodigingProbleem,
} from "./uitnodigingHelpers";
import "./JoinGroup.css";

// Een gedeelde uitnodigingslink (/groepen/join/:token) inwisselen. Voor veel
// spelers is dit het allereerste scherm ná registratie — ze komen binnen via
// een link in de groepsapp.
//
// Tot #923 wisselde deze route het token meteen bij mount in: je tikte in
// WhatsApp op een link en zat een tel later in een groep waarvan je de naam
// nog niet had gezien. Nu haalt hij eerst de preview op (naam, leden,
// uitnodiger) en wacht hij op een expliciete "Word lid". Deze route zit achter
// ProtectedRoute, dus de gebruiker is hier ingelogd.

// De hub. Niet "/groepen": dat pad bestaat alleen nog als redirect (#761).
const HUB = "/spelen?hub=1";

type Laadstaat =
  | { fase: "laden" }
  | { fase: "klaar"; preview: InvitePreview }
  | { fase: "fout"; probleem: UitnodigingProbleem };

export function JoinGroup() {
  usePageTitle("Uitnodiging");
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, signOut } = useAuth();

  const [staat, setStaat] = useState<Laadstaat>({ fase: "laden" });
  // Ophogen = de preview opnieuw ophalen.
  const [poging, setPoging] = useState(0);
  const [bezig, setBezig] = useState(false);
  // Een mislukte inwissel-klik (link intussen ingetrokken) overschrijft de
  // preview: die kaart klopt dan niet meer.
  const [probleem, setProbleem] = useState<UitnodigingProbleem | null>(null);
  const opnieuw = () => {
    setProbleem(null);
    setPoging((p) => p + 1);
  };

  // Alleen kijken, nog niet inwisselen. Bewust niet via useAsync: die geeft de
  // fout als string terug, en juist de code erin (`details`) onderscheidt een
  // verlopen link van een ingetrokken link.
  useEffect(() => {
    let active = true;
    setStaat({ fase: "laden" });
    previewGroupInvite(token)
      .then((preview) => {
        if (active) setStaat({ fase: "klaar", preview });
      })
      .catch((err: unknown) => {
        if (active)
          setStaat({ fase: "fout", probleem: uitnodigingProbleem(err) });
      });
    return () => {
      active = false;
    };
  }, [token, poging]);

  const preview = staat.fase === "klaar" ? staat.preview : null;

  // Namen en avatars van de leden + de uitnodiger. Profielen zijn publiek
  // leesbaar, dus dit mag gewoon vanaf de client. Mislukt het, dan blijft de
  // kaart staan zonder gezichten — decoratie hoort geen foutstaat te worden.
  const profielIds = preview
    ? [
        ...new Set([...preview.member_ids, preview.inviter_id ?? ""]),
      ].filter(Boolean)
    : [];
  const profielSleutel = profielIds.join(",");
  const profielen = useAsync(
    () => getProfilesByIds(profielIds),

    [profielSleutel],
    { enabled: profielIds.length > 0 },
  );
  const pmap = profielen.data ?? {};
  const naamVan = (id: string | null | undefined) =>
    (id && (pmap[id]?.full_name?.trim() || pmap[id]?.username)) || null;

  // "Al lid" is geen fout maar een succespad: gewoon doorsturen naar de groep.
  // Eén keer — in StrictMode draait het effect twee keer.
  const doorgestuurd = useRef(false);
  useEffect(() => {
    if (preview?.status !== "member" || !preview.group_id) return;
    if (doorgestuurd.current) return;
    doorgestuurd.current = true;
    toast.info("Je zit al in deze groep.");
    navigate(`/groepen/${preview.group_id}`, { replace: true });
  }, [preview, navigate, toast]);

  async function wordLid() {
    if (!preview || bezig) return;
    setBezig(true);
    setProbleem(null);
    try {
      const groupId = await redeemGroupInvite(token);
      toast.success(`Je bent lid van ${preview.group_name ?? "de groep"}.`);
      navigate(`/groepen/${groupId}`, { replace: true });
    } catch (err) {
      // De link kan tussen het bekijken en het klikken ingetrokken zijn.
      setProbleem(uitnodigingProbleem(err));
      setBezig(false);
    }
  }

  if (probleem) return <Fout probleem={probleem} onOpnieuw={opnieuw} />;
  if (staat.fase === "fout")
    return <Fout probleem={staat.probleem} onOpnieuw={opnieuw} />;
  if (!preview) return <Laden tekst="We halen de uitnodiging op…" />;
  if (preview.status === "expired")
    return <Fout probleem="verlopen" onOpnieuw={opnieuw} />;
  if (preview.status === "unknown")
    return <Fout probleem="onbekend" onOpnieuw={opnieuw} />;
  // Het effect hierboven navigeert weg; dit is wat je die tel ziet.
  if (preview.status === "member")
    return <Laden tekst="Je zit al in deze groep — we brengen je erheen…" />;

  const uitnodiger = naamVan(preview.inviter_id);
  const verval = vervalTekst(preview.expires_at);
  const ikNaam = naamVan(user?.id) ?? user?.email ?? "dit account";

  return (
    <Kader>
      <p className="join__intro">
        {uitnodiger
          ? `${uitnodiger} nodigt je uit voor`
          : "Je bent uitgenodigd voor"}
      </p>
      <h1 className="join__groep">{preview.group_name}</h1>

      <p className="join__leden">
        <MemberStack
          ids={preview.member_ids}
          profiles={pmap}
          size={28}
          total={preview.member_count}
        />
        <span>{ledenLabel(preview.member_count)}</span>
      </p>

      {verval && <p className="join__verval">{verval}</p>}

      <div className="join__acties">
        <button
          type="button"
          className="btn btn--primary join__knop"
          onClick={wordLid}
          disabled={bezig}
        >
          {bezig ? "Bezig…" : `Word lid van ${preview.group_name}`}
        </button>
        <Link className="btn join__knop" to={HUB}>
          Nee, terug naar mijn groepen
        </Link>
      </div>

      {/* Uitnodigingen zijn niet accountgebonden: je wordt lid met het account
          waarmee je nu ingelogd bent. Wie op een gedeelde telefoon of met het
          account van zijn partner binnenkomt, ziet dat hier vóór de klik in
          plaats van erna. Uitloggen bewaart de bestemming — na het inloggen
          kom je terug op deze uitnodiging (ProtectedRoute). */}
      <p className="join__account">
        Je doet mee als <strong>{ikNaam}</strong>.{" "}
        <button
          type="button"
          className="join__wissel"
          onClick={() => signOut()}
        >
          Ander account gebruiken
        </button>
      </p>
    </Kader>
  );
}

/** Kaart met merkkop; alle staten van dit scherm delen hem. */
function Kader({ children }: { children: ReactNode }) {
  return (
    <div className="join">
      <div className="join__merk">
        <BallIcon size={26} />
        <span className="join__merknaam">Vamos!</span>
      </div>
      <div className="card join__kaart">{children}</div>
    </div>
  );
}

/** Laadstaat in de vorm van de kaart die eraan komt, met uitleg erbij. */
function Laden({ tekst }: { tekst: string }) {
  return (
    <Kader>
      <InviteSkeleton />
      <p className="join__laadtekst" role="status">
        {tekst}
      </p>
    </Kader>
  );
}

/** Doodlopende staat mét een weg vooruit die bij de oorzaak past. */
function Fout({
  probleem,
  onOpnieuw,
}: {
  probleem: UitnodigingProbleem;
  onOpnieuw: () => void;
}) {
  const { titel, tekst, actie } = UITNODIGING_TEKST[probleem];
  return (
    <Kader>
      <h1 className="join__groep join__groep--fout">{titel}</h1>
      <p className="join__uitleg">{tekst}</p>
      <div className="join__acties">
        {actie === "opnieuw" && (
          <button
            type="button"
            className="btn btn--primary join__knop"
            onClick={onOpnieuw}
          >
            Opnieuw proberen
          </button>
        )}
        {actie === "login" && (
          <Link className="btn btn--primary join__knop" to="/login">
            Opnieuw inloggen
          </Link>
        )}
        <Link
          className={`btn join__knop${actie === "hub" ? " btn--primary" : ""}`}
          to={HUB}
        >
          Naar mijn groepen
        </Link>
      </div>
    </Kader>
  );
}

export default JoinGroup;
