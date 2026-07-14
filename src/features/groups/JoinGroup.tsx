import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { redeemGroupInvite } from "./api";

// Wisselt een gedeelde uitnodigingslink (/groepen/join/:token) in: voegt de
// ingelogde gebruiker toe aan de groep en stuurt door naar de groepspagina.
// Deze route zit achter ProtectedRoute, dus de gebruiker is hier altijd ingelogd.
export function JoinGroup() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  // In StrictMode draait het effect twee keer; één keer inwisselen volstaat.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let active = true;
    redeemGroupInvite(token)
      .then((groupId) => {
        if (!active) return;
        toast.success("Je bent lid van de groep.");
        navigate(`/groepen/${groupId}`, { replace: true });
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [token, navigate, toast]);

  if (error) {
    return (
      <div className="card">
        <h1 className="page-title">Uitnodiging</h1>
        <p className="msg msg--error">{error}</p>
        <Link className="btn btn--primary" to="/groepen">
          Naar mijn groepen
        </Link>
      </div>
    );
  }

  return <div className="route-loading">Uitnodiging inwisselen…</div>;
}

export default JoinGroup;
