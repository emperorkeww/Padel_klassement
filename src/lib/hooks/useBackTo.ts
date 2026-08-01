import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Terugknop die de app niet uitloopt (#910).
 *
 * `navigate(-1)` is prima als je binnen de app op deze pagina bent beland, maar
 * bij een deeplink uit een pushbericht of een gedeelde link is er geen vorige
 * pagina en stap je de app uit. React Router houdt in `history.state.idx` bij
 * de hoeveelste entry van deze sessie je bent; is dat 0, dan is dit het begin
 * van de sessie en gaan we naar het opgegeven vangnet.
 */
export function useBackTo(fallback: string) {
  const navigate = useNavigate();

  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

export default useBackTo;
