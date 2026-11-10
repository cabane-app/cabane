import { DOOR_PRESETS } from "@cabane/catalog/architecture";
import { isGardenGate, omitUndefinedProperties } from "@cabane/engine";
import type { DoorConfiguration } from "@cabane/engine";
import { LengthInput } from "../../editor-chrome/LengthInput";

const gatePresets = DOOR_PRESETS.filter(({ id }) => isGardenGate(id));

export function DoorDesignFields({
  value,
  onChange,
  showSize = true,
}: {
  value: DoorConfiguration;
  onChange: (value: DoorConfiguration) => void;
  showSize?: boolean;
}) {
  return (
    <>
      {showSize && (
        <fieldset>
          <legend>Size</legend>
          <label>
            Width
            <LengthInput
              label="Door width"
              min={0.3}
              value={value.widthMeters}
              onCommit={(widthMeters) => onChange({ ...value, widthMeters })}
            />
          </label>
          <label>
            Height
            <LengthInput
              label="Door height"
              min={0.3}
              value={value.heightMeters}
              onCommit={(heightMeters) => onChange({ ...value, heightMeters })}
            />
          </label>
        </fieldset>
      )}
      <fieldset className="construction-inspector__variants">
        <legend>Door design</legend>
        <label>
          Motion
          <select
            aria-label="Door operation"
            value={value.operation}
            onChange={(event) => {
              const base = {
                kind: "door" as const,
                finish: value.finish,
                openingSide: value.openingSide,
                widthMeters: value.widthMeters,
                heightMeters: value.heightMeters,
              };
              if (event.target.value === "roll-up")
                onChange(
                  omitUndefinedProperties({ ...base, operation: "roll-up", variant: "slatted" }),
                );
              else if (event.target.value === "sliding")
                onChange(
                  omitUndefinedProperties({
                    ...base,
                    operation: "sliding",
                    variant:
                      value.operation === "roll-up" || isGardenGate(value.variant)
                        ? "panel"
                        : value.variant,
                    leafCount: value.leafCount ?? 1,
                  }),
                );
              else
                onChange(
                  omitUndefinedProperties({
                    ...base,
                    operation: "hinged",
                    variant: value.operation === "roll-up" ? "panel" : value.variant,
                    leafCount: value.leafCount ?? 1,
                  }),
                );
            }}
          >
            <option value="hinged">Hinged</option>
            <option value="sliding">Sliding</option>
            <option value="roll-up">Roll-up</option>
          </select>
        </label>
        {value.operation === "roll-up" ? (
          <label>
            Style
            <select aria-label="Door style" value="slatted" disabled>
              <option value="slatted">Slatted</option>
            </select>
          </label>
        ) : (
          <>
            <label>
              Style
              <select
                aria-label="Door style"
                value={value.variant}
                onChange={(event) => {
                  const variant = event.target.value as typeof value.variant;
                  if (isGardenGate(variant)) {
                    if (value.operation !== "hinged") return;
                    const {
                      frontOverlayMeters: _overlay,
                      frontSide: _frontSide,
                      ...design
                    } = value;
                    onChange({ ...design, variant });
                  } else {
                    onChange({ ...value, variant });
                  }
                }}
              >
                <option value="panel">Panel</option>
                <option value="french">French</option>
                <option value="full-glass">Full glass</option>
                <option value="concealed">Concealed · no frame</option>
                <option value="flush-knob">Flush · black knob</option>
                <option value="flush">Flush</option>
                <option value="steel-arched">Arched steel glass</option>
                <option value="plank">Plank</option>
                {value.operation === "hinged" &&
                  gatePresets.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Leaves
              <select
                aria-label="Door leaf count"
                value={value.leafCount}
                onChange={(event) =>
                  onChange({ ...value, leafCount: Number(event.target.value) as 1 | 2 })
                }
              >
                <option value={1}>Single</option>
                <option value={2}>Double</option>
              </select>
            </label>
          </>
        )}
        {value.variant !== "garden-anthracite" && value.variant !== "garden-metal" && (
          <label>
            Finish
            <select
              aria-label="Door finish"
              value={value.finish}
              onChange={(event) =>
                onChange({ ...value, finish: event.target.value as "wood" | "white" })
              }
            >
              <option value="wood">Wood</option>
              <option value="white">White</option>
            </select>
          </label>
        )}
      </fieldset>
    </>
  );
}
