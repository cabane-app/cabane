import { useEffect, useId, useRef, useState } from "react";
import { displayLength, lengthUnit, parseLength, useMeasurementUnits } from "@cabane/engine";
import { EditorIcon } from "./EditorIcon";
import "./length-input.css";

type Props = {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  commitOnChange?: boolean;
  metersPerUnit?: number;
  id?: string;
  showSteppers?: boolean;
};

/** Values and limits remain in authored units. Only the edit buffer uses display units. */
export function LengthInput(props: Props) {
  const units = useMeasurementUnits();
  return <LengthDraft key={`${units}:${props.metersPerUnit ?? 1}`} {...props} units={units} />;
}
function LengthDraft({
  label,
  value,
  onCommit,
  min,
  max,
  step = 0.1,
  commitOnChange = false,
  metersPerUnit = 1,
  id: inputId,
  showSteppers = false,
  units,
}: Props & { units: "metric" | "imperial" }) {
  const format = (value: number) =>
    String(Number(displayLength(value * metersPerUnit, units).toFixed(6)));
  const [draft, setDraft] = useState(() => format(value));
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const ownCommit = useRef<number | null>(null);
  const [source, setSource] = useState(value);
  const [error, setError] = useState(false);
  if (source !== value) {
    setSource(value);
    if (ownCommit.current !== value) setDraft(format(value));
    ownCommit.current = null;
    setError(false);
  }
  useEffect(() => {
    input.current?.setCustomValidity(error ? "Enter a valid length within the allowed range." : "");
  }, [error]);
  const commit = (text: string) => {
    if (text === format(value)) return;
    const next = parseLength(text, units) / metersPerUnit;
    if (
      !Number.isFinite(next) ||
      (min !== undefined && next < min) ||
      (max !== undefined && next > max)
    ) {
      setError(true);
      return;
    }
    setError(false);
    if (Math.abs(next - value) > 1e-10) {
      ownCommit.current = next;
      onCommit(next);
    }
  };
  const parsedDraft = parseLength(draft, units) / metersPerUnit;
  const stepBase = Number.isFinite(parsedDraft) ? parsedDraft : value;
  const increment = (direction: number, large = false) => {
    const increment = units === "imperial" ? 0.0254 / metersPerUnit : step;
    const next = Number(
      Math.min(
        max ?? Infinity,
        Math.max(min ?? -Infinity, stepBase + direction * increment * (large ? 10 : 1)),
      ).toFixed(10),
    );
    setDraft(format(next));
    setError(false);
    if (next !== value) {
      ownCommit.current = next;
      onCommit(next);
    }
  };
  return (
    <span className="editor-length-input" data-steppers={showSteppers || undefined}>
      <input
        id={inputId}
        ref={input}
        aria-label={label}
        aria-invalid={error || undefined}
        aria-describedby={`${id}-unit${error ? ` ${id}-error` : ""}`}
        min={min === undefined ? undefined : displayLength(min * metersPerUnit, units)}
        max={max === undefined ? undefined : displayLength(max * metersPerUnit, units)}
        title={`Length in ${lengthUnit(units)}; also accepts m, cm, ft and in`}
        type="text"
        inputMode="text"
        value={draft}
        onInput={(event) => {
          const text = event.currentTarget.value;
          setDraft(text);
          setError(false);
          if (commitOnChange && text.trim()) commit(text);
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (!["Enter", "Escape", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          if (event.key === "Escape") {
            setDraft(format(value));
            setError(false);
          } else if (event.key === "Enter") commit(draft);
          else increment(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
        }}
      />
      <small className="editor-length-input__unit" id={`${id}-unit`}>
        {lengthUnit(units)}
      </small>
      {showSteppers && (
        <span className="editor-length-input__steppers" role="group" aria-label={`Adjust ${label}`}>
          {([1, -1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              aria-label={`${direction === 1 ? "Increase" : "Decrease"} ${label}`}
              title={`Step ${units === "imperial" ? "1 in" : `${step * metersPerUnit} m`}; hold Shift for ×10`}
              disabled={
                direction === 1
                  ? max !== undefined && stepBase >= max
                  : min !== undefined && stepBase <= min
              }
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => increment(direction, event.shiftKey)}
            >
              <EditorIcon name={direction === 1 ? "arrowUp" : "arrowDown"} />
            </button>
          ))}
        </span>
      )}
      {error && (
        <small className="editor-length-input__error" id={`${id}-error`} role="alert">
          Enter a valid length
          {min !== undefined ? ` of at least ${format(min)} ${lengthUnit(units)}` : ""}
          {max !== undefined ? ` and at most ${format(max)} ${lengthUnit(units)}` : ""}.
        </small>
      )}
    </span>
  );
}
