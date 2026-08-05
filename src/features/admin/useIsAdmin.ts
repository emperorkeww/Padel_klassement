import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { whoami } from "./api";

// Is de ingelogde gebruiker beheerder (#1036)? Gebruikt door DashboardLayout
// (menu-item) en door AdminPaneel (toegangsscherm).
//
// `null` = nog niet bekend. De aanroepers behandelen dat niet als "nee": het
// menu-item blijft weg tot het antwoord er is, en het paneel toont zolang een
// laadstaat in plaats van "Geen toegang" — anders flitst er een afwijzing voor
// een beheerder die gewoon nog aan het laden was.
//
// Dit is puur cosmetisch. Verbergen is geen beveiliging: de edge function
// weigert een niet-beheerder hoe dan ook, en /admin haalt zonder `true` geen
// enkele gebruiker op. Daarom mag dit leunen op een gecachet antwoord.
export function useIsAdmin(): boolean | null {
  const { session } = useAuth();
  const uid = session?.user?.id ?? "";
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!uid) {
      setIsAdmin(null);
      return;
    }
    let actief = true;
    // whoami() cachet zelf (5 min), dus de tweede aanroeper in dezelfde sessie
    // — het paneel naast de layout — deelt de belofte en fetcht niet opnieuw.
    whoami()
      .then((res) => {
        if (actief) setIsAdmin(res);
      })
      .catch(() => {
        // Een storing mag geen beheerscherm openzetten, en hoeft de gewone
        // gebruiker ook niets te melden: het item blijft simpelweg weg.
        if (actief) setIsAdmin(false);
      });
    return () => {
      actief = false;
    };
  }, [uid]);

  return isAdmin;
}
