import { gardenGateColor } from "@cabane/catalog/architecture";
import { isGardenGate, type EditorOpening } from "@cabane/engine";

function defaultColor(opening: Exclude<EditorOpening, { kind: "passage" }>) {
  if (opening.variant === "steel-arched") return "#292e2d";
  if (opening.kind === "window") return "#e7e2d8";
  if (isGardenGate(opening.variant)) return gardenGateColor(opening.variant, opening.finish);
  const white = opening.finish === "white";
  if (opening.operation === "roll-up") return white ? "#dddcd6" : "#ad8559";
  if (opening.variant === "plank") return white ? "#e6e3dc" : "#85583b";
  if (opening.variant === "french" || opening.variant === "full-glass")
    return white ? "#d8d2c6" : "#9c6b49";
  if (opening.variant === "flush" || opening.variant === "flush-knob")
    return white ? "#e9e8e2" : "#b89a73";
  return white ? "#f1f0eb" : "#b89a73";
}

export function OpeningColorControls({
  opening,
  onChange,
}: {
  opening: Exclude<EditorOpening, { kind: "passage" }>;
  onChange: (opening: EditorOpening) => void;
}) {
  return (
    <fieldset>
      <legend>Finish color</legend>
      <label>
        <span>Color</span>
        <input
          type="color"
          aria-label={`${opening.kind === "door" ? "Door" : "Window"} color`}
          value={opening.color ?? defaultColor(opening)}
          onInput={(event) => onChange({ ...opening, color: event.currentTarget.value })}
        />
      </label>
      <button
        type="button"
        disabled={opening.color === undefined}
        onClick={() => {
          const next = { ...opening };
          delete next.color;
          onChange(next);
        }}
      >
        Reset color
      </button>
    </fieldset>
  );
}
