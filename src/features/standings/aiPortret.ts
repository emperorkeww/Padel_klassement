import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types";

// AI-portretten aan de clientkant (#682, uit dictatorPortret.ts #554 getrokken):
// wanneer is een bewaard portret vervallen, en hoe vraag je een nieuw aan? De
// dictator (De Troon) en de pias (De Schandpaal) delen die twee vragen; wat ze
// níet delen is het moment waarop je pre-warmt — de dictator heeft een goedkope
// voorspeller (rating ≥ 1576, magDictatorPortretGenereren), de pias niet. Bij de
// pias is de client-aanroep dus puur een vangnet: je bent zélf de globale pias en
// je portret is er nog niet.

export type PortretSoort = "dictator" | "pias";

/** Sentinel-bron voor een gebruiker zonder profielfoto (spiegelt GEEN_AVATAR in
 *  supabase/functions/_shared/aiPortret.ts): zo geldt het portret als vervallen
 *  zodra hij later wél een avatar uploadt. */
export const GEEN_AVATAR_BRON = "__geen_avatar__";

/** De profielvelden per soort — dezelfde kolomnamen als STIJLEN in de edge
 *  function, zodat client en server naar hetzelfde kijken. */
const KOLOMMEN = {
  dictator: {
    url: "dictator_avatar_url",
    bron: "dictator_avatar_bron",
    optOut: "dictator_portret",
  },
  pias: {
    url: "pias_avatar_url",
    bron: "pias_avatar_bron",
    optOut: "pias_portret",
  },
} as const satisfies Record<
  PortretSoort,
  { url: keyof Profile; bron: keyof Profile; optOut: keyof Profile }
>;

/** Is het bewaarde portret van deze soort vervallen t.o.v. de huidige
 *  profielfoto? True als er nog geen portret is of de bron niet meer matcht
 *  (fotowissel). */
export function portretVervallen(
  p: Pick<Profile, "avatar_url"> & Partial<Profile>,
  soort: PortretSoort,
): boolean {
  const { url, bron } = KOLOMMEN[soort];
  const huidigeBron = p.avatar_url ?? GEEN_AVATAR_BRON;
  return !p[url] || p[bron] !== huidigeBron;
}

/** Het portret van deze soort om te tonen, of null: geen portret, of de eigenaar
 *  heeft de opt-out aan staan. Eén plek voor die beslissing, zodat troon en
 *  schandpaal niet elk hun eigen versie van "mag dit getoond worden" hebben. */
export function portretVoor(
  p: Partial<Profile> | null | undefined,
  soort: PortretSoort,
): string | null {
  if (!p) return null;
  const { url, optOut } = KOLOMMEN[soort];
  if (p[optOut] === false) return null;
  return (p[url] as string | null | undefined) ?? null;
}

/** Roept de edge function fire-and-forget aan om het eigen portret te (her)maken.
 *  De function leidt de userId uit de JWT af en respecteert opt-out en
 *  idempotentie, dus dit is veilig om vaker aan te roepen. Faalt stil — de kaart
 *  toont zolang de gewone avatar. */
export async function prewarmPortret(soort: PortretSoort): Promise<void> {
  try {
    await supabase.functions.invoke(`generate-${soort}-avatar`, { body: {} });
  } catch {
    // fire-and-forget
  }
}
