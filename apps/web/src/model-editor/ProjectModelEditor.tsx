import { useState } from "react";
import {
  defaultModelLighting,
  displayLength,
  lengthUnit,
  projectModelLighting,
  useMeasurementUnits,
  type CustomModelLight,
  type HomeProject,
  type ProjectModelRegistries,
} from "@cabane/engine";
import { ModelImportDialog } from "../custom-models/ModelImportDialog";
import { ModelVisual } from "../editor-preview/furnish/catalog/ModelVisual";
import { lightingError } from "../model-lighting/lighting-layout";
import { ModelEditorDialog } from "./ModelEditorDialog";
import { ModelEditorWorkspace } from "./ModelEditorWorkspace";
import type { ModelEditorChange } from "./save-model-editor";

type Props = {
  project: HomeProject;
  modelId: string;
  native: ProjectModelRegistries;
  onSave: (change: ModelEditorChange) => Promise<void>;
  onCancel: () => void;
};

/** Arrange and My models open the same personal definition editor. */
export function ProjectModelEditor(props: Props) {
  const custom = props.project.customModels?.find((model) => model.id === props.modelId);
  if (custom)
    return (
      <ModelImportDialog
        existingModel={custom}
        copyCount={props.project.sceneItems.filter((item) => item.modelId === props.modelId).length}
        missingModelOptions={[]}
        onCancel={props.onCancel}
        onImport={async (model) => {
          await props.onSave({ kind: "personal", model });
          props.onCancel();
        }}
      />
    );
  return <CatalogModelEditor {...props} />;
}

function CatalogModelEditor({ project, modelId, native, onSave, onCancel }: Props) {
  const definition = native.deviceModels[modelId] ?? native.furnishingModels[modelId];
  const [value, setValue] = useState<CustomModelLight | null>(
    () => projectModelLighting(project, modelId, native) ?? null,
  );
  const [reset, setReset] = useState(false);
  const units = useMeasurementUnits();
  const count = project.sceneItems.filter((item) => item.modelId === modelId).length;
  const invalid = lightingError(value);
  const device = native.deviceModels[modelId];
  return (
    <ModelEditorDialog
      name={definition?.label ?? modelId}
      scope={`Lighting applies to all ${count} placed ${count === 1 ? "copy" : "copies"} in this home. Placement, variants and Home Assistant connections belong to each copy.`}
      saveLabel={`Save for ${count} ${count === 1 ? "copy" : "copies"}`}
      canSave={!!definition && !invalid}
      onCancel={onCancel}
      onSave={async () => {
        await onSave({ kind: "catalog", modelId, light: reset ? undefined : value });
        onCancel();
      }}
    >
      {(busy) => (
        <>
          {definition ? (
            <ModelEditorWorkspace
              value={value}
              bounds={definition.bounds}
              geometryKey={definition}
              disabled={busy}
              onChange={(next) => {
                setValue(next);
                setReset(false);
              }}
              onResetLighting={() => {
                setValue(defaultModelLighting(definition) ?? null);
                setReset(true);
              }}
              resetLabel="Reset to default"
              modelSettings={
                <>
                  <h3>Catalog model</h3>
                  <dl className="model-editor-facts">
                    <dt>Name</dt>
                    <dd>{definition.label}</dd>
                    <dt>Type</dt>
                    <dd>{device ? "Device" : "Furniture"}</dd>
                    <dt>Default dimensions</dt>
                    <dd>
                      {definition.defaultSize
                        .map((n) => Number(displayLength(n, units).toFixed(3)))
                        .join(" × ")}{" "}
                      {lengthUnit(units)}
                    </dd>
                  </dl>
                  <p className="lighting-note">
                    Catalog geometry and profiles are fixed. Use Arrange to resize, rotate or choose
                    a supported variant for an individual copy.
                  </p>
                  <p className="lighting-note">
                    Open Lighting to customize sources and glow for every copy of this model in this
                    home.
                  </p>
                </>
              }
            >
              <ModelVisual
                previewOn
                entry={
                  device
                    ? { key: modelId, modelId, kind: "device", definition: device }
                    : {
                        key: modelId,
                        modelId,
                        kind: "furnishing",
                        definition: native.furnishingModels[modelId],
                      }
                }
              />
            </ModelEditorWorkspace>
          ) : (
            <p role="alert" className="model-editor-error">
              This model is unavailable. Restore its catalog or model pack, then reopen the editor.
            </p>
          )}
          {invalid && (
            <p role="alert" className="model-editor-error">
              {invalid}
            </p>
          )}
        </>
      )}
    </ModelEditorDialog>
  );
}
