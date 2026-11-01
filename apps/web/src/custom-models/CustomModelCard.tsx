import { useState } from "react";
import { createModelAssetRepository, downloadCabaneBytes, type CustomModel } from "@cabane/engine";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import type { CatalogEntry } from "../editor-preview/furnish/catalog/catalog";
import { ModelThumbnail } from "../editor-preview/furnish/catalog/ModelThumbnailRenderer";
import type { useEditorWorkspace } from "../editor-preview/useEditorWorkspace";
import "./custom-model-card.css";
import { renameCustomModel, removeCustomModel } from "./custom-model-edits";

export function CustomModelCard({
  workspace,
  entry,
  disabled,
  onChoose,
  onEdit,
}: {
  workspace: ReturnType<typeof useEditorWorkspace>;
  entry: CatalogEntry;
  disabled: boolean;
  onChoose: () => void;
  onEdit: (model: CustomModel) => void;
}) {
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const models = workspace.snapshot.project.customModels ?? [];
  const model = models.find((model) => model.id === entry.modelId);
  if (!model) return null;
  const used = workspace.snapshot.project.sceneItems.some((item) => item.modelId === model.id);
  const download = () => {
    setError(null);
    void createModelAssetRepository(window.indexedDB)
      .verify([model.asset])
      .then(([asset]) =>
        downloadCabaneBytes(
          asset!.bytes,
          `${model.name.replace(/[^a-z0-9-]/gi, "_")}.glb`,
          "model/gltf-binary",
        ),
      )
      .catch((error: unknown) =>
        setError(error instanceof Error ? error.message : "Could not download this model."),
      );
  };
  return (
    <article className="catalog-card custom-model-card" aria-label={`${model.name} model`}>
      <div className="custom-model-preview">
        <button
          type="button"
          className="custom-model-place"
          aria-label={`Add ${model.name}`}
          disabled={
            disabled || (entry.kind === "device" && entry.definition.supportedDomains.length === 0)
          }
          onClick={onChoose}
        >
          <ModelThumbnail entry={entry} />
        </button>
        <div className="custom-model-preview-actions">
          <EditorButton
            className="custom-model-icon"
            aria-label={`Edit ${model.name}`}
            title="Edit model"
            disabled={disabled}
            onClick={() => onEdit(model)}
          >
            <EditorIcon name="settings" />
          </EditorButton>
          <EditorButton
            className="custom-model-icon"
            aria-label={`Download ${model.name} GLB`}
            title="Download GLB"
            disabled={disabled}
            onClick={download}
          >
            <EditorIcon name="import" />
          </EditorButton>
          <EditorButton
            className="custom-model-icon"
            aria-label={`Remove ${model.name}`}
            title={used ? "Remove this model's instances first." : "Remove unused model"}
            disabled={disabled || used}
            onClick={() => workspace.commit(removeCustomModel(workspace.snapshot, model.id))}
          >
            <EditorIcon name="delete" />
          </EditorButton>
        </div>
      </div>
      {name !== null ? (
        <form
          className="custom-model-rename"
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled && name.trim()) {
              workspace.commit(renameCustomModel(workspace.snapshot, model.id, name));
              setName(null);
            }
          }}
        >
          <input
            aria-label="Model name"
            required
            autoFocus
            value={name}
            disabled={disabled}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setName(null);
            }}
          />
          <EditorButton
            type="submit"
            className="custom-model-icon"
            aria-label="Save model name"
            disabled={disabled}
          >
            <EditorIcon name="check" />
          </EditorButton>
          <EditorButton
            className="custom-model-icon"
            aria-label="Cancel rename"
            onClick={() => setName(null)}
          >
            <EditorIcon name="close" />
          </EditorButton>
        </form>
      ) : (
        <button
          type="button"
          className="custom-model-name"
          aria-label={`Rename ${model.name}`}
          title="Rename model"
          disabled={disabled}
          onClick={() => setName(model.name)}
        >
          {model.name}
        </button>
      )}
      <small>{entry.kind === "device" ? "Device" : "Furniture"}</small>
      {error && (
        <p className="catalog-add-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
