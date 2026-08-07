/**
 * Laadvorm van het maandraster (#1091): dezelfde zeven kolommen en dezelfde
 * celhoogte als het echte raster. Bladeren tussen maanden mag de pagina niet
 * laten springen, dus het aantal rijen komt van de maand die geladen wordt —
 * niet van een vast getal.
 */
export function RasterSkeleton({ rijen }: { rijen: number }) {
  return (
    <div className="agenda-raster agenda-raster--skelet" aria-hidden="true">
      <div className="agenda-raster__grid">
        {Array.from({ length: rijen }).map((_, week) => (
          <div className="agenda-raster__week" key={week}>
            {Array.from({ length: 7 }).map((_, dag) => (
              <span className="agenda-skelet-dag" key={dag} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default RasterSkeleton;
