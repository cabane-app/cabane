import { FLAT_TERRAIN, type TerrainSettings } from "@cabane/engine";
import { useId } from "react";
import { EditorButton } from "../../editor-chrome/EditorButton";
import { LengthInput } from "../../editor-chrome/LengthInput";
import { SidebarSectionSummary } from "../../editor-chrome/SidebarSectionSummary";
import "./terrain-settings.css";

const corners = [
  ["topLeftMeters", "Top left"],
  ["topRightMeters", "Top right"],
  ["bottomLeftMeters", "Bottom left"],
  ["bottomRightMeters", "Bottom right"],
] as const;

export function TerrainSettingsEditor({
  value = FLAT_TERRAIN,
  disabled = false,
  onChange,
}: {
  value?: TerrainSettings | undefined;
  disabled?: boolean;
  onChange: (settings: TerrainSettings) => void;
}) {
  const id = useId();
  return (
    <details className="construction-inspector__floor-disclosure terrain-settings">
      <SidebarSectionSummary
        icon="outdoor-space"
        title="Terrain"
        description="Slope the ground around your home."
      />
      <section
        className="construction-inspector__floor-settings sidebar-section-content"
        aria-label="Terrain settings"
      >
        <p className="sidebar-section-note">
          Corners match the 2D plan. Set 0 at ground-floor level, a positive height to raise the
          ground, or a negative height to lower it.
        </p>
        {disabled && (
          <p className="sidebar-section-note">Set apartment floor to 0 to edit terrain.</p>
        )}
        <fieldset className="terrain-settings__corners" disabled={disabled}>
          <legend>Ground height</legend>
          {corners.map(([corner, label]) => (
            <div className="terrain-settings__corner" key={corner}>
              <label htmlFor={`${id}-${corner}`}>{label}</label>
              <LengthInput
                id={`${id}-${corner}`}
                label={`Terrain ${label.toLowerCase()}`}
                value={value[corner]}
                min={-100}
                max={100}
                showSteppers
                onCommit={(height) => onChange({ ...value, [corner]: height })}
              />
            </div>
          ))}
          <EditorButton
            type="button"
            variant="text"
            className="terrain-settings__reset"
            disabled={Object.values(value).every((height) => height === 0)}
            onClick={() => onChange(FLAT_TERRAIN)}
          >
            Reset to flat ground
          </EditorButton>
        </fieldset>
        <p className="sidebar-section-note">View changes in 3D Arrange or Explore.</p>
      </section>
    </details>
  );
}
