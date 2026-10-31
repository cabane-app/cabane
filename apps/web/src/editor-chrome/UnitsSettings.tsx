import { useMeasurementUnits, setMeasurementUnits } from "@cabane/engine";
import { SidebarSectionSummary } from "./SidebarSectionSummary";

/**
 * The display-unit preference shared by Walk's Preferences dialog and the Construct
 * inspector. It is browser-local and never rescales stored geometry.
 */
export function UnitsSettings() {
  const units = useMeasurementUnits();
  return (
    <details className="construction-inspector__floor-disclosure">
      <SidebarSectionSummary
        icon="measure"
        title="Units"
        description={units === "imperial" ? "Imperial (ft, ft²)" : "Metric (m, m²)"}
      />
      {/* Shares Walk's Preferences radio group so the two views stay in lockstep. */}
      <div className="sidebar-section-content">
        <fieldset className="walk-preferences__choices">
          <legend>Length and area</legend>
          {(["metric", "imperial"] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="editor-measurement-units"
                value={value}
                checked={units === value}
                onChange={() => setMeasurementUnits(value)}
              />
              <span>{value === "metric" ? "Metric (m, m²)" : "Imperial (ft, ft²)"}</span>
            </label>
          ))}
        </fieldset>
        <p className="sidebar-section-note">
          Applies to editor measurements only. You can also enter lengths such as 90 cm or 5&apos;
          6&quot;.
        </p>
      </div>
    </details>
  );
}
