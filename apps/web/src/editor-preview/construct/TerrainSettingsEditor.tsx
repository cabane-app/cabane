import { FLAT_TERRAIN, type TerrainSettings } from "@cabane/engine";
import { EditorButton } from "../../editor-chrome/EditorButton";
import { LengthInput } from "../../editor-chrome/LengthInput";
import { SidebarSectionSummary } from "../../editor-chrome/SidebarSectionSummary";

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
  return (
    <details className="construction-inspector__floor-disclosure">
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
          Corner heights follow the 2D plan around the home. Zero meets the ground floor. Use
          negative heights for a lower entrance.
        </p>
        {disabled && (
          <p className="sidebar-section-note">Set apartment floor to 0 to edit terrain.</p>
        )}
        <fieldset disabled={disabled}>
          <legend>Corner heights</legend>
          {corners.map(([corner, label]) => (
            <label key={corner}>
              {label}
              <LengthInput
                label={`Terrain ${label.toLowerCase()}`}
                value={value[corner]}
                min={-100}
                max={100}
                onCommit={(height) => onChange({ ...value, [corner]: height })}
              />
            </label>
          ))}
          <EditorButton
            type="button"
            variant="text"
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
