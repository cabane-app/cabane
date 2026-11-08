import {
  FLOOR_FINISH_PRESETS,
  GRASS_FLOOR_FINISH,
  floorFinishRepresentativeColor,
  paintFloorPattern,
  type FloorFinishSpec,
} from "@cabane/engine";
import { useEffect, useRef } from "react";

function PresetSwatch({
  preset,
  color,
}: {
  preset: (typeof FLOOR_FINISH_PRESETS)[number];
  color: string | undefined;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let context: CanvasRenderingContext2D | null | undefined;
    try {
      context = canvas.current?.getContext("2d");
    } catch {
      context = null;
    }
    if (context) paintFloorPattern(context, preset.id, "plan", color);
  }, [preset, color]);
  return <canvas ref={canvas} width={64} height={64} aria-hidden="true" />;
}

export function FloorFinishPalette({
  value,
  showGrass = false,
  onChange,
}: {
  value: FloorFinishSpec;
  showGrass?: boolean;
  onChange: (finish: FloorFinishSpec) => void;
}) {
  const selected = value.kind === "preset" ? value.preset : value.kind;
  const solidColor = value.kind === "solid" ? value.color : "#d3cec5";
  return (
    <section className="floor-finish-palette" aria-label="Floor finish">
      <div className="floor-finish-palette__grid">
        <button
          type="button"
          aria-label="Solid color"
          aria-pressed={selected === "solid"}
          onClick={() => onChange({ kind: "solid", color: solidColor })}
        >
          <span style={{ background: solidColor }} aria-hidden="true" />
          <small>Solid</small>
        </button>
        {(showGrass || value.kind === "grass") && (
          <button
            type="button"
            aria-label="Grass"
            aria-pressed={selected === "grass"}
            onClick={() => onChange(GRASS_FLOOR_FINISH)}
          >
            <span
              style={{ background: floorFinishRepresentativeColor(GRASS_FLOOR_FINISH) }}
              aria-hidden="true"
            />
            <small>Grass</small>
          </button>
        )}
        {FLOOR_FINISH_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-label={preset.label}
            aria-pressed={selected === preset.id}
            onClick={() => onChange({ kind: "preset", preset: preset.id })}
          >
            <PresetSwatch
              preset={preset}
              color={
                value.kind === "preset" && value.preset === preset.id ? value.color : undefined
              }
            />
            <small>{preset.label}</small>
          </button>
        ))}
      </div>
      {value.kind === "preset" &&
        FLOOR_FINISH_PRESETS.find((preset) => preset.id === value.preset)?.configurableColor && (
          <label>
            Tile color
            <input
              type="color"
              aria-label="Tile color"
              value={
                value.color ??
                FLOOR_FINISH_PRESETS.find((preset) => preset.id === value.preset)!
                  .representativeColor
              }
              onChange={(event) => onChange({ ...value, color: event.target.value })}
            />
            <button
              type="button"
              onClick={() => onChange({ kind: "preset", preset: value.preset })}
            >
              Reset color
            </button>
          </label>
        )}
      {selected === "solid" && (
        <label>
          Solid color
          <input
            type="color"
            aria-label="Solid floor color"
            value={solidColor}
            onChange={(event) =>
              onChange({
                kind: "solid",
                color: event.target.value,
              })
            }
          />
        </label>
      )}
    </section>
  );
}
