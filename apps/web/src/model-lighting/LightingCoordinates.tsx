import type { ModelVector } from "@cabane/engine";
import { displayLength, lengthUnit, useMeasurementUnits } from "@cabane/engine";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { LengthInput } from "../editor-chrome/LengthInput";

const STEP_METERS = [0.001, 0.01, 0.1] as const;

const metricStepLabel = (value: number) =>
  value === 0.001 ? "1 mm" : value === 0.01 ? "1 cm" : "10 cm";

const imperialStepLabel = (meters: number) =>
  `${Number(displayLength(meters, "imperial").toFixed(2))} ${lengthUnit("imperial")}`;

export function LightingCoordinates({
  position,
  label,
  step,
  onStep,
  onChange,
}: {
  position: ModelVector;
  label: string;
  step: number;
  onStep: (step: number) => void;
  onChange: (position: ModelVector) => void;
}) {
  const units = useMeasurementUnits();
  const move = (index: number, value: number) =>
    onChange(
      position.map((n, axis) => (axis === index ? Number(value.toFixed(6)) : n)) as [
        number,
        number,
        number,
      ],
    );
  return (
    <fieldset className="lighting-position">
      <legend>{label}</legend>
      <label className="lighting-step">
        Move by
        <select
          aria-label="Movement step"
          value={step}
          onChange={(event) => onStep(Number(event.target.value))}
        >
          {STEP_METERS.map((value) => (
            <option key={value} value={value}>
              {units === "imperial" ? imperialStepLabel(value) : metricStepLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <div className="lighting-coordinates">
        {["X", "Y", "Z"].map((axis, index) => (
          <div key={axis} className="lighting-coordinate">
            <label>
              <span>
                {axis} <small>{["Left / right", "Height", "Front / back"][index]}</small>
              </span>
              <LengthInput
                label={label + " " + axis}
                value={position[index]}
                step={step}
                onCommit={(value) => move(index, value)}
              />
            </label>
            <div className="lighting-coordinate-steps">
              <EditorButton
                aria-label={"Decrease " + axis}
                onClick={() => move(index, position[index] - step)}
              >
                <EditorIcon name="minus" />
              </EditorButton>
              <EditorButton
                aria-label={"Increase " + axis}
                onClick={() => move(index, position[index] + step)}
              >
                <EditorIcon name="plus" />
              </EditorButton>
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
