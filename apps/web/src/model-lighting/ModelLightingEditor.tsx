import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { modelLightSources } from "@cabane/engine";
import type {
  CustomModelLight,
  DeviceModelBounds,
  ModelLightingSurfaceOption,
  ModelVector,
} from "@cabane/engine";
import { LightingStage } from "./LightingStage";
import { LightingFields } from "./LightingFields";
import { moveLightSource, withLightSources, type LightingSelection } from "./lighting-layout";
import "./model-lighting.css";
export function ModelLightingEditor({
  value,
  onChange,
  bounds,
  children,
  disabled = false,
}: {
  value: CustomModelLight | null;
  onChange: (value: CustomModelLight | null) => void;
  bounds: DeviceModelBounds;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<LightingSelection>({ index: 0 });
  const [step, setStep] = useState(0.01);
  const [picking, setPicking] = useState<"position" | "surface" | null>(null);
  const [surfaces, setSurfaces] = useState<ModelLightingSurfaceOption[]>([]);
  const [brightness, setBrightness] = useState(100);
  const previous = useRef<CustomModelLight | null>(value);
  const state = useMemo(
    () => ({
      entityId: "light.preview" as const,
      state: brightness > 0 ? "on" : "off",
      attributes: { brightness: Math.round((brightness * 255) / 100) },
      available: true,
      stale: false,
    }),
    [brightness],
  );
  const receiveSurfaces = useCallback(
    (next: ModelLightingSurfaceOption[]) =>
      setSurfaces((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      ),
    [],
  );
  const change = (next: CustomModelLight | null) => {
    if (next) previous.current = next;
    onChange(next);
  };
  const place = (position: ModelVector) => {
    if (!value) return;
    change(moveLightSource(value, selected, position));
  };
  return (
    <fieldset disabled={disabled} className="model-lighting-editor">
      <div className="lighting-enable">
        <label>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(event) => {
              change(
                event.target.checked
                  ? (previous.current ?? {
                      position: [0, (bounds.min[1] + bounds.max[1]) / 2, bounds.max[2]],
                      color: "#ffe3b4",
                      maxIntensity: 2,
                      distance: 5,
                    })
                  : null,
              );
              setSelected({ index: 0 });
              setPicking(event.target.checked ? "position" : null);
            }}
          />
          Enable lighting
        </label>
      </div>
      <div className="lighting-layout">
        <div className="lighting-preview-column">
          <LightingStage
            bounds={bounds}
            light={value}
            disabled={disabled}
            step={step}
            state={state}
            selected={selected}
            picking={picking}
            onPosition={place}
            onRotateStrip={(start, end) => {
              if (value)
                change(
                  withLightSources(
                    value,
                    modelLightSources(value).map((source, index) =>
                      index === selected.index && source.kind === "strip"
                        ? { ...source, start, end }
                        : source,
                    ),
                  ),
                );
            }}
            onSelect={(index) => {
              setSelected(index);
              setPicking(null);
            }}
            onSurface={(id, materialName) => {
              if (!value) return;
              const ids = value.emissiveSurfaces ?? [];
              const materials = value.emissiveMaterials ?? [];
              const savedMaterial = materials.includes(materialName);
              if (!savedMaterial && !ids.includes(id) && ids.length + materials.length >= 16)
                return;
              change({
                ...value,
                ...(savedMaterial
                  ? { emissiveMaterials: materials.filter((name) => name !== materialName) }
                  : {}),
                emissiveSurfaces:
                  savedMaterial || ids.includes(id)
                    ? ids.filter((value) => value !== id)
                    : [...ids, id],
              });
            }}
            onSurfaces={receiveSurfaces}
          >
            {children}
          </LightingStage>
          <div className="lighting-preview-controls">
            <label>
              Preview brightness
              <input
                aria-label="Preview brightness"
                type="range"
                min={0}
                max={100}
                value={brightness}
                onChange={(event) => setBrightness(Number(event.target.value))}
              />
              <output>{brightness}%</output>
            </label>
          </div>
        </div>
        {value ? (
          <LightingFields
            light={value}
            onChange={change}
            bounds={bounds}
            selected={selected}
            onSelect={setSelected}
            picking={picking}
            onPicking={setPicking}
            surfaces={surfaces}
            step={step}
            onStep={setStep}
          />
        ) : (
          <p className="lighting-empty">Enable lighting to add sources and glow.</p>
        )}
      </div>
      {value?.emissiveSurfaces?.some(
        (id) => !surfaces.some((surface) => surface.id === id && surface.supported),
      ) && (
        <p role="status" className="lighting-warning">
          Some saved surfaces are unavailable. Choose another surface or restore the original model.
        </p>
      )}
    </fieldset>
  );
}
