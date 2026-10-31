import {
  displayLength,
  storedLength,
  parseLength,
  lengthUnit,
  useMeasurementUnits,
} from "@cabane/engine";
import { useId, useState } from "react";

const format = (value: number) => String(Number(value.toFixed(4)));
const parse = (text: string) => {
  const normalized = text.trim().replace(",", ".");
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) ? Number(normalized) : NaN;
};

/** Keep incomplete edits local; only complete, valid values reach item history. */
function ScalarNumericField({
  label,
  value,
  disabled,
  onChange,
  step = 0.1,
  min,
  unit,
  parseValue = parse,
  stepLabel,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  unit?: string;
  parseValue?: (text: string) => number;
  stepLabel?: string;
}) {
  const id = useId();
  const [source, setSource] = useState(value);
  const [draft, setDraft] = useState(format(value));
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  if (source !== value) {
    setSource(value);
    setDirty(false);
    setDraft(format(value));
    setError("");
  }
  const commit = (next: number) => {
    if (!Number.isFinite(next) || (min !== undefined && next < min)) {
      setError(
        min === undefined
          ? "Enter a valid number."
          : `Enter a number of at least ${min}${unit ? ` ${unit}` : ""}.`,
      );
      return;
    }
    setError("");
    setDirty(false);
    setDraft(format(next));
    if (next !== value) onChange(next);
  };
  const increment = (direction: number, large: boolean) => {
    const parsed = parseValue(draft);
    const next = Number(
      (
        (dirty && Number.isFinite(parsed) ? parsed : value) +
        direction * step * (large ? 10 : 1)
      ).toFixed(10),
    );
    commit(min === undefined ? next : Math.max(min, next));
  };
  return (
    <div className="arrange-numeric-field">
      <label htmlFor={id}>
        <span>
          {label}
          {unit && <span className="arrange-numeric-field__unit"> · {unit}</span>}
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onInput={(event) => {
            setDraft(event.currentTarget.value);
            setDirty(true);
            setError("");
          }}
          onBlur={() => {
            if (dirty) commit(parseValue(draft));
          }}
          onKeyDown={(event) => {
            if (!["Enter", "Escape", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            if (event.key === "Enter") {
              if (dirty) commit(parseValue(draft));
            } else if (event.key === "Escape") {
              setDraft(format(value));
              setDirty(false);
              setError("");
            } else increment(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
          }}
        />
      </label>
      <div role="group" aria-label={`Adjust ${label}`}>
        {([-1, 1] as const).map((direction) => (
          <button
            key={direction}
            type="button"
            disabled={disabled}
            aria-label={`${direction === 1 ? "Increase" : "Decrease"} ${label}`}
            title={`Step ${stepLabel ?? `${step}${unit ? ` ${unit}` : ""}`}; hold Shift for ×10`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => increment(direction, event.shiftKey)}
          >
            {direction === 1 ? "+" : "−"}
          </button>
        ))}
      </div>
      {error && (
        <small id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export function NumericField(
  props: Parameters<typeof ScalarNumericField>[0] & { metersPerUnit?: number },
) {
  const units = useMeasurementUnits();
  if (props.unit !== "m" && props.unit !== "plan units") return <ScalarNumericField {...props} />;
  // Plan-coordinate fields are authored in plan units, whose physical size is the floor's
  // metres-per-plan-unit scale. They follow the unit preference through that scale; fields
  // without it (e.g. in dialogs without a floor) keep their authored number.
  const scale = props.metersPerUnit ?? (props.unit === "plan units" ? undefined : 1);
  return (
    <ScalarNumericField
      {...props}
      key={units}
      unit={scale === undefined ? (props.unit ?? lengthUnit(units)) : lengthUnit(units)}
      value={scale === undefined ? props.value : displayLength(props.value * scale, units)}
      {...(props.min === undefined || scale === undefined
        ? {}
        : { min: displayLength(props.min * scale, units) })}
      stepLabel={units === "imperial" ? "1 in" : `${(props.step ?? 0.1) * (scale ?? 1)} m`}
      step={units === "imperial" ? 1 / 12 : (props.step ?? 0.1) * (scale ?? 1)}
      {...(scale === undefined || props.parseValue === undefined
        ? {}
        : {
            parseValue: (text: string) => displayLength(parseLength(text, units), units),
          })}
      onChange={(value) =>
        scale === undefined
          ? props.onChange(value)
          : props.onChange(storedLength(value, units) / scale)
      }
    />
  );
}
