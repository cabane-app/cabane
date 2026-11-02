import { MeasurementText } from "@cabane/engine";
import { useRef, useState } from "react";
import {
  CUSTOM_MODEL_LIMITS,
  editCustomModel,
  createCabaneModelPack,
  createModelAssetRepository,
  downloadCabaneBytes,
  modelAssetReferences,
  readCabaneModelPack,
  resolveProjectModels,
  stageModelAssets,
  type CustomModel,
  type EditorWorkspaceSnapshot,
  type ModelAsset,
} from "@cabane/engine";
import { ownerProjectRegistries } from "../project-runtime";
import { EditorButton } from "../editor-chrome/EditorButton";
import { ModelImportDialog } from "./ModelImportDialog";
import { useEditorWorkspace } from "../editor-preview/useEditorWorkspace";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { ModelGenerationGuide } from "./ModelGenerationGuide";
import "./custom-models.css";
import { saveCustomModel } from "./custom-model-edits";

export function CustomModelLibrary({
  workspace,
  disabled,
  onBrowse,
  editingModel,
  onCloseEditor,
  onEditSnapshot,
}: {
  workspace: ReturnType<typeof useEditorWorkspace>;
  disabled: boolean;
  onBrowse: () => void;
  editingModel: CustomModel | null;
  onCloseEditor: () => void;
  onEditSnapshot: (snapshot: EditorWorkspaceSnapshot) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const packPicker = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [packFile, setPackFile] = useState<File | null>(null);
  const [generationGuide, setGenerationGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packBusy, setPackBusy] = useState(false);
  const models = workspace.snapshot.project.customModels ?? [];
  const registries = resolveProjectModels(workspace.snapshot.project, ownerProjectRegistries);
  const missingModelOptions = [
    ...workspace.snapshot.project.sceneItems.reduce((counts, item) => {
      const registry =
        item.kind === "device" ? registries.deviceModels : registries.furnishingModels;
      if (!Object.hasOwn(registry, item.modelId)) {
        const key = `${item.kind}:${item.modelId}`;
        const previous = counts.get(key);
        counts.set(key, {
          key,
          id: item.modelId,
          kind: item.kind,
          count: (previous?.count ?? 0) + 1,
        });
      }
      return counts;
    }, new Map<string, { key: string; id: string; kind: "furnishing" | "device"; count: number }>()),
  ].map(([, option]) => option);
  const importModel = async (
    model: CustomModel,
    asset: ModelAsset,
    replacementKey: string | null,
  ) => {
    const assets = new Map(
      workspace.modelAssetReferences.map((asset) => [asset.sha256, asset.byteLength]),
    );
    assets.set(asset.sha256, asset.byteLength);
    if ([...assets.values()].reduce((sum, size) => sum + size, 0) > CUSTOM_MODEL_LIMITS.homeBytes)
      throw new Error(
        "This house and its active history exceed 100 MiB of distinct assets. Save and reopen the editor before importing more.",
      );
    await stageModelAssets([asset]);
    const replacement = replacementKey
      ? missingModelOptions.find((option) => option.key === replacementKey)
      : undefined;
    workspace.commit(
      editCustomModel(
        workspace.snapshot,
        model,
        replacement ? { modelId: replacement.id, kind: replacement.kind } : undefined,
      ),
    );
    const saved = await workspace.flush();
    if (saved.status !== "saved")
      throw new Error("Could not save the model. Your draft is kept in memory. Try again.");
    setFile(null);
    onBrowse();
  };
  const importPack = async () => {
    if (!packFile || packBusy) return;
    setPackBusy(true);
    setError(null);
    try {
      const pack = await readCabaneModelPack(new Uint8Array(await packFile.arrayBuffer()));
      const next = pack.models.reduce(
        (snapshot, model) => editCustomModel(snapshot, model),
        workspace.snapshot,
      );
      const references = new Map(
        workspace.modelAssetReferences.map((asset) => [asset.sha256, asset.byteLength]),
      );
      for (const reference of modelAssetReferences([next.project]))
        references.set(reference.sha256, reference.byteLength);
      if (
        [...references.values()].reduce((sum, size) => sum + size, 0) >
        CUSTOM_MODEL_LIMITS.homeBytes
      )
        throw new Error("This house and its active history exceed 100 MiB of distinct assets.");
      await stageModelAssets(pack.assets);
      workspace.commit(next);
      const saved = await workspace.flush();
      if (saved.status !== "saved")
        throw new Error("Could not save the model pack. Your draft is kept in memory. Try again.");
      setPackFile(null);
      onBrowse();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not import this model pack.");
    } finally {
      setPackBusy(false);
    }
  };
  const exportPack = () => {
    if (!models.length || packBusy) return;
    setPackBusy(true);
    setError(null);
    void createModelAssetRepository(window.indexedDB)
      .verify(modelAssetReferences([{ customModels: models }]))
      .then((assets) => createCabaneModelPack(models, assets))
      .then((bytes) => downloadCabaneBytes(bytes, "cabane-models.zip", "application/zip"))
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Could not export the model pack."),
      )
      .finally(() => setPackBusy(false));
  };
  return (
    <div className="custom-model-library">
      <div className="custom-model-actions">
        <EditorButton disabled={disabled} onClick={() => picker.current?.click()}>
          <EditorIcon name="import" />
          Import model (.glb file)
        </EditorButton>
        <EditorButton disabled={disabled || packBusy} onClick={() => packPicker.current?.click()}>
          <EditorIcon name="import" />
          Import model pack (.zip)
        </EditorButton>
        <EditorButton disabled={disabled || packBusy || !models.length} onClick={exportPack}>
          <EditorIcon name="export" />
          Export model pack (.zip)
        </EditorButton>
        <EditorButton disabled={disabled} onClick={() => setGenerationGuide(true)}>
          <EditorIcon name="cube" />
          Generate a custom model
        </EditorButton>
      </div>
      <input
        ref={picker}
        type="file"
        accept=".glb,model/gltf-binary"
        hidden
        onChange={(event) => {
          const next = event.target.files?.[0];
          event.target.value = "";
          setError(null);
          if (next && next.size > CUSTOM_MODEL_LIMITS.fileBytes)
            setError("GLB files must be at most 10 MiB.");
          else if (next) setFile(next);
        }}
      />
      <input
        ref={packPicker}
        type="file"
        accept=".zip,.cabane,application/zip"
        hidden
        onChange={(event) => {
          const next = event.target.files?.[0];
          event.target.value = "";
          setError(null);
          if (next && next.size > CUSTOM_MODEL_LIMITS.homeBytes + 5 * 1024 * 1024)
            setError("Model packs must be at most 105 MiB.");
          else if (next) setPackFile(next);
        }}
      />
      {error && (
        <p role="alert" className="catalog-add-error">
          <MeasurementText>{error}</MeasurementText>
        </p>
      )}
      {editingModel && (
        <ModelImportDialog
          key={editingModel.id}
          existingModel={editingModel}
          missingModelOptions={[]}
          onCancel={onCloseEditor}
          onImport={async (model) => {
            if (disabled) throw new Error("The editor is busy. Try again when it is ready.");
            await saveCustomModel(workspace, model, onEditSnapshot);
            onCloseEditor();
          }}
        />
      )}
      {file && (
        <ModelImportDialog
          file={file}
          missingModelOptions={missingModelOptions}
          onCancel={() => setFile(null)}
          onImport={importModel}
        />
      )}
      {packFile && (
        <dialog open className="model-pack-dialog" aria-label="Import model pack">
          <form
            method="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void importPack();
            }}
          >
            <h2>Import model pack</h2>
            <p>
              Add the models and GLB files from <strong>{packFile.name}</strong> to this workspace.
              Existing model IDs are kept when their asset is identical.
            </p>
            {error && (
              <p role="alert" className="catalog-add-error">
                <MeasurementText>{error}</MeasurementText>
              </p>
            )}
            <div className="custom-model-pack-actions">
              <EditorButton disabled={packBusy} onClick={() => setPackFile(null)}>
                Cancel
              </EditorButton>
              <EditorButton type="submit" variant="primary" disabled={packBusy}>
                {packBusy ? "Importing…" : "Import pack"}
              </EditorButton>
            </div>
          </form>
        </dialog>
      )}
      {generationGuide && (
        <ModelGenerationGuide
          onClose={() => setGenerationGuide(false)}
          onImport={() => {
            setGenerationGuide(false);
            picker.current?.click();
          }}
        />
      )}
    </div>
  );
}
