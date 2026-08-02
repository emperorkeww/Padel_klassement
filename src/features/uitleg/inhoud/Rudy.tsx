import { CoachAbout } from "@/features/coach/components/CoachAbout";

/** Sectie 11: wie Coach Rudy is en hoe je hem afstelt (#989). `CoachAbout`
 *  (#212) is de bestaande uitleg plus de vindbare bediening; die staat ook in
 *  de instellingen, dus hier hoort geen tweede versie van te komen. */
export function Rudy() {
  return <CoachAbout showSettingsLink />;
}

export default Rudy;
