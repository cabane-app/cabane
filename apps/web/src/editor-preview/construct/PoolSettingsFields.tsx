import type { PoolSpec } from "@cabane/engine";
import { LengthInput } from "../../editor-chrome/LengthInput";

type Settings = Required<Pick<PoolSpec, "type" | "heightMeters">>;

export function PoolSettingsFields({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  return (
    <>
      <label className="pool-type-field">
        Pool type
        <select
          aria-label="Pool type"
          value={settings.type}
          onChange={(event) =>
            onChange({ ...settings, type: event.target.value as Settings["type"] })
          }
        >
          <option value="in-ground">In-ground</option>
          <option value="above-ground-wood">Above-ground (wood)</option>
        </select>
      </label>
      <label>
        {settings.type === "above-ground-wood" ? "Height" : "Depth"}
        <LengthInput
          label={settings.type === "above-ground-wood" ? "Pool height" : "Pool depth"}
          value={settings.heightMeters}
          min={0.3}
          max={5}
          step={0.1}
          onCommit={(heightMeters) =>
            onChange({ ...settings, heightMeters: Math.min(5, Math.max(0.3, heightMeters)) })
          }
        />
      </label>
    </>
  );
}
