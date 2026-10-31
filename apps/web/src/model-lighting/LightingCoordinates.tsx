import { formatLength, useMeasurementUnits, type ModelVector } from "@cabane/engine";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { LengthInput } from "../editor-chrome/LengthInput";

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
          {([0.001, 0.01, 0.1] as const).map((value, index) => (
            <option key={value} value={value}>
              {units === "imperial"
                ? formatLength(value, units, 4)
                : ["1 mm", "1 cm", "10 cm"][index]}
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
