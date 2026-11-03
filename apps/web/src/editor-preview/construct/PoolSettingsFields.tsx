import { PoolTypeGrid } from "./PoolTypeGrid";
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
      <PoolTypeGrid value={settings.type} onChoose={(type) => onChange({ ...settings, type })} />
      <label className="pool-size-field">
        {settings.type === "above-ground-wood" ? "Height" : "Depth"}
        <LengthInput
          label={settings.type === "above-ground-wood" ? "Pool height" : "Pool depth"}
          value={settings.heightMeters}
          min={0.3}
          max={5}
          step={0.1}
          showSteppers
          onCommit={(heightMeters) =>
            onChange({ ...settings, heightMeters: Math.min(5, Math.max(0.3, heightMeters)) })
          }
        />
      </label>
    </>
  );
}
