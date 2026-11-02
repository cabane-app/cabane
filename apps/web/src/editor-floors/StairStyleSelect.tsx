import type { StairStyle } from "@cabane/engine";
import "./stair-connection-picker.css";

export function StairStyleSelect({
  value,
  onChange,
}: {
  value: StairStyle;
  onChange: (style: StairStyle) => void;
}) {
  return (
    <label className="construction-inspector__single-control stair-style-select">
      Style
      <select
        aria-label="Stair style"
        value={value}
        onChange={(event) => onChange(event.target.value as StairStyle)}
      >
        <option value="open">Open treads</option>
        <option value="concrete">Concrete</option>
        <option value="stone">Stone</option>
      </select>
    </label>
  );
}
