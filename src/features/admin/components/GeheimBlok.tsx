import { KopieerVeld } from "@/ui/KopieerVeld";

// Toont een eenmalig geheim — een herstel-link of een tijdelijk wachtwoord —
// met een kopieerknop (#1036).
//
// Bewust géén state die dit langer bewaart dan het paneel openstaat, en bewust
// geen plek in de querycache: de waarde bestaat alleen in deze component en
// verdwijnt zodra de sheet dichtgaat. Wie hem opnieuw nodig heeft, deelt een
// nieuwe uit — dat is goedkoop en veiliger dan hem laten rondslingeren.
//
// Het veld met de kopieerknop is sinds #1298 het gedeelde `KopieerVeld`; dit
// blijft de omkadering die zegt dat het om een geheim gaat.

export function GeheimBlok({
  label,
  waarde,
  waarschuwing,
}: {
  label: string;
  waarde: string;
  /** Wat de beheerder moet weten vóór hij dit doorgeeft. */
  waarschuwing: string;
}) {
  return (
    <KopieerVeld
      className="admin-geheim"
      label={label}
      waarde={waarde}
      hint={waarschuwing}
    />
  );
}
