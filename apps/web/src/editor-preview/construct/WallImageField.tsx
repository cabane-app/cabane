import { useEffect, useId, useRef, useState } from "react";
import {
  formatLength,
  useMeasurementUnits,
  wallSurfaceRepeatHeight,
  type WallImageFinish,
} from "@cabane/engine";
import { EditorButton } from "../../editor-chrome/EditorButton";
import { LengthInput } from "../../editor-chrome/LengthInput";
import { prepareWallImage } from "./prepare-wall-image";
import "./wall-image-field.css";

export function WallImageField({
  label,
  finish,
  repeatMeters,
  onChange,
}: {
  label: string;
  finish: WallImageFinish | undefined;
  repeatMeters: number;
  onChange: (finish: WallImageFinish) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const currentRepeat = useRef(repeatMeters);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();
  const units = useMeasurementUnits();
  useEffect(
    () => () => {
      operation.current++;
    },
    [],
  );
  useEffect(() => {
    currentRepeat.current = repeatMeters;
  }, [repeatMeters]);
  return (
    <div className="wall-image-field">
      <div className="wall-image-field__source">
        {finish && (
          <img
            src={finish.image.dataUrl}
            alt={`${label} image preview`}
            className="wall-image-field__preview"
          />
        )}
        <div className="wall-image-field__file">
          {finish && (
            <span className="wall-image-field__name" title={finish.image.name}>
              {finish.image.name}
            </span>
          )}
          <EditorButton
            disabled={busy}
            aria-label={`${finish ? "Replace" : "Choose"} ${label.toLowerCase()} image`}
            onClick={() => input.current?.click()}
          >
            {busy ? "Preparing image…" : finish ? "Replace image" : "Choose image"}
          </EditorButton>
          <small id={hintId}>PNG, JPG or WebP · up to 10 MB</small>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          aria-label={`${label} image file`}
          aria-describedby={hintId}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            const current = ++operation.current;
            setBusy(true);
            setError(null);
            void prepareWallImage(file)
              .then((image) => {
                if (operation.current === current)
                  onChange({
                    pattern: "custom-image",
                    color: "#ffffff",
                    repeatMeters: currentRepeat.current,
                    image,
                  });
              })
              .catch((cause: unknown) => {
                if (operation.current === current)
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "The image could not be prepared. Try again.",
                  );
              })
              .finally(() => {
                if (operation.current === current) setBusy(false);
              });
          }}
        />
      </div>
      {error && (
        <p className="wall-image-field__error" role="alert">
          {error} Your previous finish is unchanged.
        </p>
      )}
      {finish ? (
        <>
          <label>
            Image width
            <LengthInput
              label={`${label} image width`}
              value={finish.repeatMeters}
              min={0.1}
              max={20}
              step={0.1}
              onCommit={(width) => onChange({ ...finish, repeatMeters: width })}
            />
          </label>
          <p className="wall-image-field__hint">
            Repeats every {formatLength(finish.repeatMeters, units)} ×{" "}
            {formatLength(wallSurfaceRepeatHeight(finish), units)}. Image proportions stay
            unchanged.
          </p>
        </>
      ) : (
        <p className="wall-image-field__hint">Choose an image to repeat across this face.</p>
      )}
      <p className="wall-image-field__hint">Saved with this home. Windows and doors stay clear.</p>
    </div>
  );
}
