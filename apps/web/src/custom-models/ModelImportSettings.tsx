import {
  CUSTOM_MODEL_PROFILES,
  type CustomModelProfile,
  type CustomModelPlacement,
  type CustomModelNormalization,
  type ModelVector,
} from "@cabane/engine";
import { LengthInput } from "../editor-chrome/LengthInput";

export function ModelImportSettings({
  busy,
  name,
  setName,
  placement,
  setPlacement,
  profile,
  onProfileChange,
  normalization,
  scale,
  setScale,
  rotation,
  setRotation,
}: {
  busy: boolean;
  name: string;
  setName: (value: string) => void;
  placement: CustomModelPlacement;
  setPlacement: (value: CustomModelPlacement) => void;
  profile: CustomModelProfile;
  onProfileChange: (value: CustomModelProfile) => void;
  normalization: CustomModelNormalization | null;
  scale: number;
  setScale: (value: number) => void;
  rotation: ModelVector;
  setRotation: (value: ModelVector) => void;
}) {
  const changeVector = (value: ModelVector, axis: number, next: number): ModelVector =>
    value.map((n, i) => (i === axis ? next : n)) as [number, number, number];
  return (
    <>
      <fieldset disabled={busy} className="model-import-fields">
        <label>
          Name
          <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Preferred placement
          <select
            aria-label="Preferred placement"
            value={placement}
            onChange={(e) => setPlacement(e.target.value as CustomModelPlacement)}
          >
            <option value="floor">Floor</option>
            <option value="wall">Wall</option>
            <option value="ceiling">Ceiling</option>
          </select>
        </label>
        <label>
          Profile
          <select
            aria-label="Profile"
            value={profile}
            onChange={(e) => onProfileChange(e.target.value as CustomModelProfile)}
          >
            {CUSTOM_MODEL_PROFILES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {normalization && (
        <>
          <fieldset disabled={busy} className="model-import-vectors">
            <legend>Dimensions · uniform scale</legend>
            {["Width", "Height", "Depth"].map((label, i) => (
              <label key={label}>
                {label}
                <LengthInput
                  label={label}
                  min={0.001}
                  value={Number(normalization.size[i]!.toFixed(3))}
                  onCommit={(n) => setScale((scale * n) / normalization.size[i])}
                />
              </label>
            ))}
          </fieldset>
          <details className="model-import-details">
            <summary>Orientation</summary>
            <fieldset disabled={busy} className="model-import-vectors">
              <legend className="sr-only">Orientation (degrees)</legend>
              {["X", "Y", "Z"].map((label, i) => (
                <label key={label}>
                  {label}
                  <input
                    type="number"
                    step="any"
                    value={Number(((rotation[i] * 180) / Math.PI).toFixed(2))}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n))
                        setRotation(changeVector(rotation, i, (n * Math.PI) / 180));
                    }}
                  />
                </label>
              ))}
            </fieldset>
          </details>
        </>
      )}
    </>
  );
}
