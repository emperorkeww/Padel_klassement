import { wachtwoordSterkte } from "./wachtwoordSterkte";

/**
 * Wachtwoordsterkte terwijl je typt (#922).
 *
 * Bewust géén live region: bij elke toetsaanslag "Zwak… Redelijk… Sterk" laten
 * omroepen is onbruikbaar. De aanroeper koppelt dit blok via `aria-describedby`
 * aan het wachtwoordveld, zodat een screenreader het oordeel bij het veld
 * voorleest in plaats van erdoorheen te ratelen. De segmenten zelf zijn puur
 * decoratief — het label draagt de betekenis.
 */
export function SterkteBalk({
  id,
  wachtwoord,
}: {
  id: string;
  wachtwoord: string;
}) {
  const { niveau, label } = wachtwoordSterkte(wachtwoord);
  return (
    <span className="sterkte" id={id}>
      <span className="sterkte__balk" aria-hidden="true">
        {[1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={`sterkte__segment ${
              segment <= niveau ? `sterkte__segment--n${niveau}` : ""
            }`}
          />
        ))}
      </span>
      <span className={`sterkte__label sterkte__label--n${niveau}`}>
        {label}
      </span>
    </span>
  );
}

export default SterkteBalk;
