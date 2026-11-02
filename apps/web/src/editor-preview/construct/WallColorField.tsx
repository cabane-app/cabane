import { LengthInput } from "../../editor-chrome/LengthInput";
import {
  WALL_SURFACE_PATTERNS,
  type WallSurfaceFinish,
  type WallPatternFinish,
} from "@cabane/engine";
import { useState } from "react";
import { WallImageField } from "./WallImageField";
import { EditorButton } from "../../editor-chrome/EditorButton";
import { DebouncedColorInput } from "./DebouncedColorInput";
import { useWallFinishPreview } from "./WallFinishPreview";
import type { WallFinishSide } from "./wall-finish-sides";

export function WallColorField({
  label,
  inputLabel = `${label} color`,
  value,
  overridden,
  onCommit,
  onReset,
  floorId,
  wallId,
  sides,
  finish,
  onFinishChange,
}: {
  finish?: WallSurfaceFinish | undefined;
  onFinishChange?: (finish: WallSurfaceFinish | undefined) => void;
  label: string;
  inputLabel?: string;
  value: string;
  overridden: boolean;
  onCommit: (color: string) => void;
  onReset: () => void;
  floorId: string;
  wallId: string;
  sides: readonly WallFinishSide[];
}) {
  const { setHighlight } = useWallFinishPreview();
  const [imageRequested, setImageRequested] = useState(false);
  const imageMode = imageRequested || finish?.pattern === "custom-image";
  return (
    <div
      className="wall-surface-field"
      onPointerEnter={() => setHighlight({ floorId, wallId, sides })}
      onPointerLeave={(event) => {
        if (!event.currentTarget.contains(event.currentTarget.ownerDocument.activeElement))
          setHighlight(null);
      }}
      onFocus={() => setHighlight({ floorId, wallId, sides })}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHighlight(null);
      }}
    >
      {onFinishChange && (
        <label className="wall-surface-field__pattern">
          {label} finish
          <select
            aria-label={`${label} finish`}
            value={imageMode ? "custom-image" : (finish?.pattern ?? "paint")}
            onChange={(event) => {
              const isImage = event.target.value === "custom-image";
              setImageRequested(isImage);
              if (isImage) return;
              onFinishChange(
                event.target.value === "paint"
                  ? undefined
                  : {
                      pattern: event.target.value as WallPatternFinish["pattern"],
                      color: finish?.color ?? "#8da69c",
                      repeatMeters: Math.min(finish?.repeatMeters ?? 1.2, 5),
                    },
              );
            }}
          >
            <option value="paint">Paint</option>
            {WALL_SURFACE_PATTERNS.map((pattern, index) => (
              <option key={pattern} value={pattern}>
                {
                  ["Square tiles", "Rectangular tiles", "Striped wallpaper", "Dotted wallpaper"][
                    index
                  ]
                }
              </option>
            ))}
            <option value="custom-image">Custom image</option>
          </select>
        </label>
      )}
      {imageMode && onFinishChange ? (
        <WallImageField
          label={label}
          finish={finish?.pattern === "custom-image" ? finish : undefined}
          repeatMeters={finish?.repeatMeters ?? 1.2}
          onChange={(next) => {
            setImageRequested(false);
            onFinishChange(next);
          }}
        />
      ) : (
        <label>
          {finish ? "Pattern color" : label}
          <DebouncedColorInput
            label={inputLabel}
            value={finish?.color ?? value}
            onCommit={(color) =>
              finish && finish.pattern !== "custom-image" && onFinishChange
                ? onFinishChange({ ...finish, color })
                : onCommit(color)
            }
          />
        </label>
      )}
      {finish && !imageMode && onFinishChange && (
        <label>
          Pattern repeat
          <span className="wall-surface-field__length">
            <LengthInput
              label={`${label} pattern repeat`}
              min={0.1}
              max={5}
              step={0.1}
              value={finish.repeatMeters}
              onCommit={(repeatMeters) => onFinishChange({ ...finish, repeatMeters })}
            />
          </span>
        </label>
      )}
      {overridden && !finish && (
        <EditorButton
          type="button"
          variant="text"
          aria-label={`Reset ${label.toLowerCase()} color`}
          onClick={onReset}
        >
          Reset
        </EditorButton>
      )}
    </div>
  );
}
