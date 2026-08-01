import { useEffect, useRef, useState } from "react";
import { naarCanvas, type Uitsnede } from "./avatarCrop";

/**
 * Vierkant uitsnijden vóór het uploaden (#921).
 *
 * De avatar wordt overal rond en klein getoond, maar een staande telefoonfoto
 * ging ongecontroleerd door de schaal heen: je kop half buiten beeld. Hier kies
 * je zelf wát er in het kader valt — zoomen met de schuifregelaar, verschuiven
 * door te slepen — en wat eruit komt is een vierkante JPEG.
 *
 * Bewust zonder cropper-dependency: dit is een canvas-tekening van een paar
 * regels, en een extra pakket voor één scherm is duurder dan het onderhoud.
 */

export function AvatarCropper({
  bestand,
  onChange,
}: {
  bestand: File;
  /** Geeft de gekozen uitsnede en het geladen beeld door aan de kaart. */
  onChange: (uitsnede: Uitsnede, beeld: HTMLImageElement | null) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const sleep = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // De blob-URL werd nooit vrijgegeven (#921): elke fotokeuze lekte er één.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(bestand);
    setUrl(objectUrl);
    setZoom(1);
    setPos({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(objectUrl);
  }, [bestand]);

  // De kaart heeft de uitsnede én het geladen beeld nodig om te kunnen opslaan.
  useEffect(() => {
    onChange(naarCanvas(zoom, pos), imgRef.current);
  }, [zoom, pos, onChange, url]);

  return (
    <div className="avatar-crop">
      <div
        className="avatar-crop__kader"
        onPointerDown={(e) => {
          sleep.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!sleep.current) return;
          setPos({
            x: e.clientX - sleep.current.x,
            y: e.clientY - sleep.current.y,
          });
        }}
        onPointerUp={() => {
          sleep.current = null;
        }}
      >
        {url && (
          <img
            ref={imgRef}
            src={url}
            alt="Voorbeeld van je nieuwe profielfoto"
            draggable={false}
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
            }}
            onLoad={() => onChange(naarCanvas(zoom, pos), imgRef.current)}
          />
        )}
      </div>

      <label className="avatar-crop__zoom">
        <span>Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          aria-label="Zoom"
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </label>
      <p className="avatar-hint">Sleep de foto om te kiezen wat in beeld valt.</p>
    </div>
  );
}

export default AvatarCropper;
