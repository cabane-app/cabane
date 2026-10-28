import { LengthInput } from "../editor-chrome/LengthInput";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createBrowserUuid,
  createModelAssetRepository,
  CUSTOM_MODEL_PROFILES,
  openGlbPreview,
  normalizeGlb,
  type CustomModelLight,
  type CustomModel,
  type CustomModelProfile,
  type CustomModelPlacement,
  type ModelVector,
  type ModelAsset,
} from "@cabane/engine";
import { ModelEditorDialog } from "../model-editor/ModelEditorDialog";
import { ModelEditorWorkspace } from "../model-editor/ModelEditorWorkspace";
import type { ModelEditorSection } from "../model-editor/ModelEditorSections";
import { lightingError, renormalizeLighting } from "../model-lighting/lighting-layout";
import "./custom-models.css";

type Loaded = Awaited<ReturnType<typeof openGlbPreview>>;
type MissingModelOption = { key: string; id: string; kind: "furnishing" | "device"; count: number };

export function ModelImportDialog({
  file,
  existingModel,
  onImport,
  onCancel,
  missingModelOptions,
  copyCount = 0,
  initialSection = "model",
}: {
  onImport: (model: CustomModel, asset: ModelAsset, replacementId: string | null) => Promise<void>;
  onCancel: () => void;
  missingModelOptions: readonly MissingModelOption[];
  copyCount?: number;
  initialSection?: ModelEditorSection;
} & ({ file: File; existingModel?: never } | { file?: never; existingModel: CustomModel })) {
  const [id] = useState(() => existingModel?.id ?? (`custom:${createBrowserUuid()}` as const));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(existingModel?.name ?? file?.name.replace(/\.glb$/i, "") ?? "");
  const [placement, setPlacement] = useState<CustomModelPlacement>(
    existingModel?.placement ?? "floor",
  );
  const [profile, setProfile] = useState<CustomModelProfile>(existingModel?.profile ?? "furniture");
  const [rotation, setRotation] = useState<ModelVector>(
    existingModel?.normalization.rotation ?? [0, 0, 0],
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
  const [lightingEnabled, setLightingEnabled] = useState(Boolean(existingModel?.light));
  const previousNormalization = useRef<CustomModel["normalization"] | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const existingAsset = existingModel?.asset;
  const replacementOptions = missingModelOptions.filter((option) =>
    profile === "furniture" ? option.kind === "furnishing" : option.kind === "device",
  );
  useEffect(() => {
    if (replacementId && !replacementOptions.some((option) => option.key === replacementId))
      setReplacementId("");
  }, [replacementId, replacementOptions]);
  useEffect(() => {
    let active = true;
    let resource: Loaded | undefined;
    void (async () => {
      const bytes = existingAsset
        ? (await createModelAssetRepository(window.indexedDB).verify([existingAsset]))[0]!.bytes
        : new Uint8Array(await file!.arrayBuffer());
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
  }, [file, existingAsset]);
  const normalization = useMemo(() => {
    if (!loaded) return null;
    if (
      existingModel &&
      placement === existingModel.placement &&
      scale === existingModel.normalization.scale &&
      rotation.every((n, axis) => n === existingModel.normalization.rotation[axis])
    )
      return existingModel.normalization;
    return normalizeGlb(loaded.root, placement, rotation, scale);
  }, [loaded, placement, rotation, scale, existingModel]);
  useEffect(() => {
    const previous = previousNormalization.current;
    if (normalization && previous && normalization !== previous)
      setLightSettings((light) => renormalizeLighting(light, previous, normalization));
    previousNormalization.current = normalization;
  }, [normalization]);
  const light = lightingEnabled ? lightSettings : undefined;
  const lightError = lightingError(light ?? null);
  const valid = Boolean(
    name.trim() && loaded && normalization && Number.isFinite(scale) && scale > 0 && !lightError,
  );
  const changeVector = (value: ModelVector, axis: number, next: number): ModelVector =>
    value.map((n, i) => (i === axis ? next : n)) as [number, number, number];
  return (
    <ModelEditorDialog
      name={name}
      scope={
        existingModel
          ? `Changes apply to this model${copyCount ? ` and ${copyCount === 1 ? "its placed copy" : `all ${copyCount} placed copies`}` : " and every copy you place"}. Placement and Home Assistant connections belong to each copy.`
          : "Create a personal model. Its settings will apply to every copy you place."
      }
      saveLabel={existingModel ? "Save changes" : "Add to My models"}
      canSave={valid}
      onCancel={onCancel}
      onSave={async () => {
        if (!loaded || !normalization) return;
        const { bytes: _bytes, ...asset } = loaded.asset;
        await onImport(
          {
            id,
            name: name.trim(),
            placement,
            profile,
            asset: existingModel?.asset ?? asset,
            normalization,
            complexity: loaded.complexity,
            ...(light ? { light } : {}),
          },
          loaded.asset,
          replacementId || null,
        );
      }}
    >
      {(busy) => (
        <>
          <ModelEditorWorkspace
            value={light ?? null}
            disabled={busy}
            bounds={
              normalization?.bounds ??
              existingModel?.normalization.bounds ?? { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }
            }
            geometryKey={loaded?.root}
            {...(lightInitialized.current ? { retainedLight: lightSettings } : {})}
            initialSection={initialSection}
            onChange={(value) => {
              setLightingEnabled(!!value);
              if (value) {
                lightInitialized.current = true;
                setLightSettings(value);
              }
            }}
            onResetLighting={() => setLightingEnabled(false)}
            modelSettings={
              <>
                {existingModel && (
                  <p className="model-import-hint">
                    Copies keep their support and relative scale. Preferred placement sets the model
                    origin and the support for new copies.
                  </p>
                )}
                {existingModel && profile !== existingModel.profile && (
                  <p className="lighting-warning" role="status">
                    Changing profile replaces each copy’s primary connection. Reconnect it in
                    Connect after saving. Independent sensor readings are retained.
                  </p>
                )}
                <fieldset disabled={busy} className="model-import-fields">
                  <label>
                    Name
                    <input
                      autoFocus
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
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
                      onChange={(e) => {
                        setProfile(e.target.value as CustomModelProfile);
                        if (
                          normalization &&
                          e.target.value === "light" &&
                          !lightInitialized.current
                        ) {
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
                      }}
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
                            value={normalization.size[i]}
                            onCommit={(n) => setScale((scale * n) / normalization.size[i])}
                          />
                        </label>
                      ))}
                    </fieldset>
                    <fieldset disabled={busy} className="model-import-vectors">
                      <legend>Orientation (degrees)</legend>
                      {["X", "Y", "Z"].map((label, i) => (
                        <label key={label}>
                          {label}
                          <input
                            aria-label={`Rotation ${label}`}
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
                  </>
                )}

                {loaded && (
                  <p className="model-import-hint">
                    {loaded.complexity.triangles.toLocaleString("en")} triangles ·{" "}
                    {loaded.complexity.visibleMeshes} meshes. Original materials and textures are
                    preserved.
                  </p>
                )}
                {loaded?.notices.map((notice) => (
                  <p className="model-import-hint" key={notice}>
                    {notice}
                  </p>
                ))}
                {profile !== "furniture" && profile !== "light" && (
                  <p className="model-import-hint">
                    Geometry stays static. Connect uses the existing{" "}
                    {CUSTOM_MODEL_PROFILES.find(([id]) => id === profile)?.[1]} controls.
                  </p>
                )}
                {replacementOptions.length > 0 && (
                  <fieldset
                    disabled={busy}
                    className="model-import-fields model-import-replacement"
                  >
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
              </>
            }
          >
            {loaded && normalization && (
              <group position={normalization.offset}>
                <group rotation={normalization.rotation} scale={normalization.scale}>
                  <primitive object={loaded.root} dispose={null} />
                </group>
              </group>
            )}
          </ModelEditorWorkspace>
          {lightError && (
            <p role="alert" className="model-editor-error">
              {lightError}
            </p>
          )}
          {error && (
            <p role="alert" className="model-editor-error">
              {error}{" "}
              {existingModel
                ? "Restore the original model pack, then reopen the editor."
                : "Close the editor and choose a supported .glb file from My models."}
            </p>
          )}
        </>
      )}
    </ModelEditorDialog>
  );
}
