import { MeasurementText, ModelPose } from "@cabane/engine";
import { ModelImportTabs, type ModelImportSection } from "./ModelImportTabs";
import { ModelImportSettings } from "./ModelImportSettings";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createBrowserUuid,
  createModelAssetRepository,
  openGlbPreview,
  normalizeGlb,
  useCabaneDom,
  type CustomModelLight,
  type CustomModel,
  type CustomModelProfile,
  type CustomModelPlacement,
  type ModelVector,
  type ModelAsset,
} from "@cabane/engine";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { ModelPoseEditor } from "./ModelPoseEditor";
import { ModelImportPreview } from "./ModelImportPreview";
import { ModelLightingEditor } from "../model-lighting/ModelLightingEditor";
import { lightingError, renormalizeLighting } from "../model-lighting/lighting-layout";
import "./custom-models.css";
import "./model-import-layout.css";

type Loaded = Awaited<ReturnType<typeof openGlbPreview>>;
type MissingModelOption = { key: string; id: string; kind: "furnishing" | "device"; count: number };

export function ModelImportDialog({
  file,
  existingModel,
  onImport,
  onCancel,
  missingModelOptions,
}: {
  onImport: (model: CustomModel, asset: ModelAsset, replacementId: string | null) => Promise<void>;
  onCancel: () => void;
  missingModelOptions: readonly MissingModelOption[];
} & ({ file: File; existingModel?: never } | { file?: never; existingModel: CustomModel })) {
  const dom = useCabaneDom();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef(dom.root.activeElement as HTMLElement | null);
  const titleId = useId();
  const [id] = useState(() => existingModel?.id ?? (`custom:${createBrowserUuid()}` as const));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(existingModel?.name ?? file?.name.replace(/\.glb$/i, "") ?? "");
  const [placement, setPlacement] = useState<CustomModelPlacement>(
    existingModel?.placement ?? "floor",
  );
  const [profile, setProfile] = useState<CustomModelProfile>(existingModel?.profile ?? "furniture");
  const [rotation, setRotation] = useState<ModelVector>(
    existingModel?.normalization.rotation ?? [0, 0, 0],
  );
  const [poses, setPoses] = useState<CustomModel["poses"]>(existingModel?.poses);
  const [previewPose, setPreviewPose] = useState<string | undefined>(
    existingModel?.poses?.defaultPose,
  );
  const [scale, setScale] = useState(existingModel?.normalization.scale ?? 1);
  const [lightSettings, setLightSettings] = useState<CustomModelLight>(
    existingModel?.light ?? {
      position: [0, 0, 0],
      color: "#ffe3b4",
      maxIntensity: 2,
      distance: 5,
    },
  );
  const lightInitialized = useRef(Boolean(existingModel?.light));
  const [section, setSection] = useState<ModelImportSection>("model");
  const [lightingEnabled, setLightingEnabled] = useState(Boolean(existingModel?.light));
  const previousNormalization = useRef<CustomModel["normalization"] | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const replacementOptions = missingModelOptions.filter((option) =>
    profile === "furniture" ? option.kind === "furnishing" : option.kind === "device",
  );
  useEffect(() => {
    if (replacementId && !replacementOptions.some((option) => option.key === replacementId))
      setReplacementId("");
  }, [replacementId, replacementOptions]);
  useEffect(() => {
    const previous = opener.current;
    dialog.current?.showModal?.();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [dom]);
  useEffect(() => {
    let active = true;
    let resource: Loaded | undefined;
    void (async () => {
      const bytes = existingModel
        ? (await createModelAssetRepository(window.indexedDB).verify([existingModel.asset]))[0]!
            .bytes
        : new Uint8Array(await file.arrayBuffer());
      resource = await openGlbPreview(bytes);
      if (active) setLoaded(resource);
      else resource.release();
    })().catch((error: unknown) => {
      if (active)
        setError(
          error instanceof Error ? error.message : "Could not read this GLB. Choose another file.",
        );
    });
    return () => {
      active = false;
      if (resource) resource.release();
    };
  }, [file, existingModel]);
  const normalization = useMemo(() => {
    if (!loaded) return null;
    if (
      existingModel &&
      placement === existingModel.placement &&
      scale === existingModel.normalization.scale &&
      poses === existingModel.poses &&
      rotation.every((n, axis) => n === existingModel.normalization.rotation[axis])
    )
      return existingModel.normalization;
    return normalizeGlb(loaded.restRoot, placement, rotation, scale, poses ? loaded.poses : []);
  }, [loaded, placement, rotation, scale, existingModel, poses]);
  useEffect(() => {
    const previous = previousNormalization.current;
    if (normalization && previous && normalization !== previous)
      setLightSettings((light) => renormalizeLighting(light, previous, normalization));
    previousNormalization.current = normalization;
  }, [normalization]);
  const light = lightingEnabled ? lightSettings : undefined;
  const lightError = lightingError(light ?? null);
  const valid =
    name.trim() && loaded && normalization && Number.isFinite(scale) && scale > 0 && !lightError;
  const changeProfile = (next: CustomModelProfile) => {
    setProfile(next as CustomModelProfile);
    setPoses((previous) =>
      previous
        ? {
            ...(previous.defaultPose !== undefined ? { defaultPose: previous.defaultPose } : {}),
            states: {},
          }
        : undefined,
    );
    if (normalization && next === "light" && !lightInitialized.current) {
      lightInitialized.current = true;
      setLightingEnabled(true);
      setLightSettings((previous) => ({
        ...previous,
        position: [
          0,
          (normalization.bounds.min[1] + normalization.bounds.max[1]) / 2,
          normalization.bounds.max[2],
        ],
      }));
    }
  };
  return (
    <dialog
      ref={dialog}
      className="model-import-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || !loaded || !normalization || busy) return;
          setBusy(true);
          setError(null);
          const { bytes, ...asset } = loaded.asset;
          void onImport(
            {
              id,
              name: name.trim(),
              placement,
              profile,
              asset: existingModel?.asset ?? asset,
              normalization,
              complexity: loaded.complexity,
              ...(light ? { light } : {}),
              ...(poses ? { poses } : {}),
            },
            loaded.asset,
            replacementId || null,
          )
            .catch((error: unknown) =>
              setError(
                error instanceof Error ? error.message : "Could not save the model. Try again.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <header>
          <h2 id={titleId}>{existingModel ? "Edit model" : "Import GLB"}</h2>
          <EditorButton
            aria-label={existingModel ? "Close model editor" : "Close import"}
            disabled={busy}
            onClick={onCancel}
          >
            <EditorIcon name="close" />
          </EditorButton>
        </header>
        <ModelImportTabs
          id={titleId}
          section={section}
          hasPoses={!!loaded?.poses.length}
          onChange={setSection}
        />
        <div
          className="model-import-panel"
          role="tabpanel"
          id={`${titleId}-panel`}
          aria-labelledby={`${titleId}-${section}-tab`}
        >
          {section !== "lighting" && (
            <div className="model-import-workspace">
              <div className="model-import-stage">
                {loaded && normalization ? (
                  <ModelImportPreview
                    root={loaded.root}
                    normalization={normalization}
                    light={light}
                    poses={loaded.poses}
                    pose={previewPose}
                  />
                ) : (
                  !error && <p role="status">Reading model…</p>
                )}
                <div className="model-import-stage-caption">
                  <span>
                    {previewPose === undefined
                      ? "Original appearance"
                      : loaded?.poses[Number(previewPose)]?.name || "Pose preview"}
                  </span>
                  <span>Drag to rotate</span>
                </div>
                {!!loaded?.poses.length && (
                  <div className="model-pose-previews" role="group" aria-label="Preview poses">
                    <EditorButton
                      aria-pressed={previewPose === undefined}
                      onClick={() => setPreviewPose(undefined)}
                    >
                      Original
                    </EditorButton>
                    {loaded.poses.map((pose, index) => (
                      <EditorButton
                        key={index}
                        aria-pressed={previewPose === String(index)}
                        onClick={() => setPreviewPose(String(index))}
                      >
                        {pose.name || `Pose ${index + 1}`}
                      </EditorButton>
                    ))}
                  </div>
                )}
              </div>
              <div className="model-import-controls">
                <div hidden={section !== "model"}>
                  <ModelImportSettings
                    busy={busy}
                    name={name}
                    setName={setName}
                    placement={placement}
                    setPlacement={setPlacement}
                    profile={profile}
                    onProfileChange={changeProfile}
                    normalization={normalization}
                    scale={scale}
                    setScale={setScale}
                    rotation={rotation}
                    setRotation={setRotation}
                  />
                  {existingModel && (
                    <p className="model-import-hint">
                      Changes apply to every placed copy. Changing profile requires reconnecting in
                      Connect.
                    </p>
                  )}
                  {loaded && (
                    <details className="model-import-details">
                      <summary>File details</summary>
                      <p className="model-import-hint">
                        {loaded.complexity.triangles.toLocaleString("en")} triangles ·{" "}
                        {loaded.complexity.visibleMeshes} meshes. Original materials and textures
                        are preserved.
                      </p>
                      {loaded.notices.map((notice) => (
                        <p className="model-import-hint" key={notice}>
                          {notice}
                        </p>
                      ))}
                    </details>
                  )}
                </div>
                {section === "poses" && loaded && (
                  <ModelPoseEditor
                    poses={loaded.poses}
                    profile={profile}
                    onProfileChange={changeProfile}
                    value={poses}
                    onChange={setPoses}
                    preview={previewPose}
                    onPreview={setPreviewPose}
                  />
                )}
              </div>
            </div>
          )}
          {section === "lighting" && loaded && normalization && (
            <div className="model-import-lighting">
              <ModelLightingEditor
                value={light ?? null}
                disabled={busy}
                bounds={normalization.bounds}
                onChange={(value) => {
                  setLightingEnabled(!!value);
                  if (value) setLightSettings(value);
                }}
              >
                <group position={normalization.offset}>
                  <group rotation={normalization.rotation} scale={normalization.scale}>
                    <ModelPose root={loaded.root} poses={loaded.poses} pose={previewPose} />
                    <primitive object={loaded.root} dispose={null} />
                  </group>
                </group>
              </ModelLightingEditor>
            </div>
          )}
        </div>
        {lightError && (
          <p role="alert" className="catalog-add-error">
            <MeasurementText>{lightError}</MeasurementText>
          </p>
        )}
        {replacementOptions.length > 0 && (
          <fieldset disabled={busy} className="model-import-fields model-import-replacement">
            <label>
              Replace missing model (optional)
              <select
                aria-label="Replace missing model (optional)"
                value={replacementId}
                onChange={(event) => setReplacementId(event.target.value)}
              >
                <option value="">Add as a new model</option>
                {replacementOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.id} · {option.count} scene item{option.count === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        )}
        {error && (
          <p role="alert" className="catalog-add-error">
            <MeasurementText>{error}</MeasurementText>
          </p>
        )}
        <footer>
          <EditorButton disabled={busy} onClick={onCancel}>
            Cancel
          </EditorButton>
          <EditorButton type="submit" variant="primary" disabled={!valid || busy}>
            {busy ? "Saving…" : existingModel ? "Save changes" : "Add to My models"}
          </EditorButton>
        </footer>
      </form>
    </dialog>
  );
}
