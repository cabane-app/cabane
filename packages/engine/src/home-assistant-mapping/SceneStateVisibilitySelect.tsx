import type { EntityBindingSlotSpec } from "../types";

type Visibility = EntityBindingSlotSpec["presentation"]["showInScene"];

export function SceneStateVisibilitySelect({
  value,
  onChange,
  label = "Show state on model",
  accessibleLabel = label,
  disabled = false,
}: {
  value: Visibility;
  onChange: (value: NonNullable<Visibility>) => void;
  label?: string;
  accessibleLabel?: string;
  disabled?: boolean;
}) {
  return (
    <label className="connection-visibility">
      <span>{label}</span>
      <select
        aria-label={accessibleLabel}
        value={value === true ? "always" : value === "if-present" ? "if-present" : "never"}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value === "always"
              ? true
              : event.target.value === "if-present"
                ? "if-present"
                : false,
          )
        }
      >
        <option value="always">Always</option>
        <option value="never">Never</option>
        <option value="if-present">Only if present</option>
      </select>
    </label>
  );
}
