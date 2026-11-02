import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createModelAssetRepository,
  defaultModelLighting,
  openGlbPreview,
  projectModelLighting,
  useCabaneDom,
  type CustomModelLight,
  type HomeProject,
  type ProjectModelRegistries,
} from "@cabane/engine";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { ModelVisual } from "../editor-preview/furnish/catalog/ModelVisual";
import { ModelLightingEditor } from "./ModelLightingEditor";
import { lightingError } from "./lighting-layout";

export function ModelLightingDialog({
  project,
  modelId,
  native,
  onSave,
  onCancel,
}: {
  project: HomeProject;
  modelId: string;
  native: ProjectModelRegistries;
  onSave: (light: CustomModelLight | null | undefined) => Promise<void>;
  onCancel: () => void;
}) {
  const dom = useCabaneDom();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef(dom.root.activeElement as HTMLElement | null);
  const title = useId();
  const custom = project.customModels?.find((model) => model.id === modelId);
  const definition = native.deviceModels[modelId] ?? native.furnishingModels[modelId];
  const asset = custom?.asset;
  const [value, setValue] = useState<CustomModelLight | null>(
    () => projectModelLighting(project, modelId, native) ?? null,
  );
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof openGlbPreview>> | null>(null);
  useEffect(() => {
    dialog.current?.showModal?.();
    const previous = opener.current;
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [dom]);
  useEffect(() => {
    if (!asset) return;
    let active = true;
    let resource: Awaited<ReturnType<typeof openGlbPreview>> | undefined;
    void (async () => {
      const verified = (await createModelAssetRepository(window.indexedDB).verify([asset]))[0];
      resource = await openGlbPreview(verified.bytes);
      if (active) setLoaded(resource);
      else resource.release();
    })().catch((error: unknown) => {
      if (active)
        setError(
          error instanceof Error
            ? error.message
            : "The original model could not be read. Restore its model pack and try again.",
        );
    });
    return () => {
      active = false;
      resource?.release();
    };
  }, [asset]);
  const geometry = useMemo(() => {
    if (custom && loaded)
      return (
        <group position={custom.normalization.offset}>
          <group rotation={custom.normalization.rotation} scale={custom.normalization.scale}>
            <primitive object={loaded.root} dispose={null} />
          </group>
        </group>
      );
    if (!definition) return null;
    return (
      <ModelVisual
        previewOn
        entry={
          native.deviceModels[modelId]
            ? { key: modelId, modelId, kind: "device", definition: native.deviceModels[modelId] }
            : {
                key: modelId,
                modelId,
                kind: "furnishing",
                definition: native.furnishingModels[modelId],
              }
        }
      />
    );
  }, [custom, loaded, definition, modelId, native]);
  const bounds = custom?.normalization.bounds ?? definition?.bounds;
  const count = project.sceneItems.filter((item) => item.modelId === modelId).length;
  const invalid = lightingError(value);
  return (
    <dialog
      ref={dialog}
      className="model-lighting-dialog"
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || invalid || !geometry) return;
          setBusy(true);
          setError(null);
          void onSave(reset && !custom ? undefined : value)
            .then(onCancel)
            .catch((error: unknown) =>
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not save lighting. Your draft is kept. Try Save again, or close and Undo.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <header>
          <h2 id={title}>{custom?.name ?? definition?.label ?? "Model"} · Lighting</h2>
          <EditorButton aria-label="Close lighting editor" disabled={busy} onClick={onCancel}>
            <EditorIcon name="close" />
          </EditorButton>
        </header>
        <p className="lighting-scope">
          Applies to <strong>{count === 1 ? "the placed copy" : `all ${count} copies`}</strong> in
          this home.
        </p>
        {bounds && geometry ? (
          <ModelLightingEditor
            value={value}
            bounds={bounds}
            disabled={busy}
            onChange={(next) => {
              setValue(next);
              setReset(false);
            }}
          >
            {geometry}
          </ModelLightingEditor>
        ) : (
          !error && <p role="status">Reading model…</p>
        )}
        {(error || invalid) && (
          <p role="alert" className="catalog-add-error">
            {error ?? invalid}
          </p>
        )}
        <footer>
          <EditorButton
            variant="text"
            disabled={busy}
            onClick={() => {
              setValue(defaultModelLighting(definition) ?? null);
              setReset(true);
            }}
          >
            {custom ? "Remove lighting" : "Reset to default"}
          </EditorButton>
          <div className="lighting-save-actions">
            <EditorButton disabled={busy} onClick={onCancel}>
              Cancel
            </EditorButton>
            <EditorButton type="submit" variant="primary" disabled={busy || !!invalid || !geometry}>
              {busy ? "Saving…" : `Save for ${count} ${count === 1 ? "copy" : "copies"}`}
            </EditorButton>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
