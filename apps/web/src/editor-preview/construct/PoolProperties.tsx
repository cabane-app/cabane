import { PoolSettingsFields } from "./PoolSettingsFields";
import { formatLength, formatArea, useMeasurementUnits } from "@cabane/engine";
import { LengthInput } from "../../editor-chrome/LengthInput";
import { EditorButton } from "../../editor-chrome/EditorButton";
import { mapPoolOutline, polygonSignedArea, type PoolSpec } from "@cabane/engine";

import type { ConstructEditorController } from "./useConstructEditor";

export function PoolProperties({
  pool,
  editor,
}: {
  pool: PoolSpec;
  editor: ConstructEditorController;
}) {
  const units = useMeasurementUnits();
  const scale = editor.draft.coordinates.metersPerPlanUnit;
  const perimeter = pool.polygon.reduce((sum, point, index) => {
    const next = pool.polygon[(index + 1) % pool.polygon.length];
    return sum + Math.hypot(point[0] - next[0], point[1] - next[1]) * scale;
  }, 0);
  return (
    <div className="construction-inspector__selection">
      <header>
        <div>
          <small>Selected pool</small>
          <strong>Pool outline</strong>
        </div>
      </header>
      <PoolSettingsFields
        settings={{ type: pool.type ?? "in-ground", heightMeters: pool.heightMeters ?? 1.5 }}
        onChange={(settings) => editor.configurePool(pool.id, settings.type, settings.heightMeters)}
      />
      <dl className="construction-inspector__wall-facts construction-inspector__pool-facts">
        <div>
          <dt>Area</dt>
          <dd>{formatArea(Math.abs(polygonSignedArea(pool.polygon)) * scale ** 2, units)}</dd>
        </div>
        <div>
          <dt>Perimeter</dt>
          <dd>{formatLength(perimeter, units)}</dd>
        </div>
      </dl>
      <p>Drag the pool to move it, or drag a corner to reshape it.</p>
      <details className="selection-details-advanced">
        <summary>Outline coordinates</summary>
        {pool.polygon.map((point, index) => (
          <fieldset key={index}>
            <legend>Corner {index + 1}</legend>
            {([0, 1] as const).map((axis) => (
              <label key={axis}>
                {axis === 0 ? "X" : "Y"}
                <LengthInput
                  metersPerUnit={scale}
                  label={`Pool corner ${index + 1} ${axis === 0 ? "X" : "Y"}`}
                  step={0.1}
                  value={Number(point[axis].toPrecision(15))}
                  onCommit={(value) =>
                    editor.updatePool(
                      pool.id,
                      mapPoolOutline(pool.polygon, (p, i) =>
                        i === index ? (axis === 0 ? [value, p[1]] : [p[0], value]) : p,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </fieldset>
        ))}
      </details>
      <EditorButton variant="text" type="button" onClick={editor.deleteSelected}>
        Delete pool
      </EditorButton>
    </div>
  );
}
