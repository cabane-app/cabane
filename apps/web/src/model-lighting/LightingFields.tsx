import {
  modelLightSources,
  modelLightingExecution,
  SCENE_LIGHT_BUDGET,
  type CustomModelLight,
  type DeviceModelBounds,
  type ModelLightingSurfaceOption,
} from "@cabane/engine";
import { LengthInput } from "../editor-chrome/LengthInput";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { LightingCoordinates } from "./LightingCoordinates";
import { LightingSources } from "./LightingSources";
import {
  fittedLightStrip,
  moveLightSource,
  sourceLabel,
  sourcePosition,
  stripSamples,
  withLightSources,
  type LightingSelection,
} from "./lighting-layout";

export function LightingFields({
  light,
  onChange,
  bounds,
  selected,
  onSelect,
  picking,
  onPicking,
  surfaces,
  step,
  onStep,
}: {
  light: CustomModelLight;
  onChange: (light: CustomModelLight) => void;
  bounds: DeviceModelBounds;
  selected: LightingSelection;
  onSelect: (selection: LightingSelection) => void;
  picking: "position" | "surface" | null;
  onPicking: (mode: "position" | "surface" | null) => void;
  surfaces: readonly ModelLightingSurfaceOption[];
  step: number;
  onStep: (step: number) => void;
}) {
  const sources = modelLightSources(light);
  const source = sources[selected.index];
  const updateSource = (next: typeof source) =>
    onChange(
      withLightSources(
        light,
        sources.map((source, i) => (i === selected.index ? next : source)),
      ),
    );
  const glowing = (light.emissiveSurfaces?.length ?? 0) + (light.emissiveMaterials?.length ?? 0);
  const execution = modelLightingExecution(light);
  return (
    <div className="lighting-fields">
      <p className="lighting-note" role="status">
        {execution.approximated
          ? `Preview approximates ${execution.requested.toLocaleString("en")} requested samples with ${execution.lights.length} physical lights. `
          : ""}
        Scenes share up to {SCENE_LIGHT_BUDGET} physical lights across active copies. Dense setups
        use fewer strip samples or merge nearby sources. Saved sources and total brightness stay
        unchanged; coverage may soften.
      </p>
      <LightingSources
        light={light}
        bounds={bounds}
        selected={selected}
        onChange={onChange}
        onSelect={(selection) => {
          onSelect(selection);
          onPicking(null);
        }}
      />
      {source && (
        <section className="lighting-source-inspector" aria-label="Selected light source">
          <div className="lighting-inspector-heading">
            <h3>{sourceLabel(sources, selected.index)}</h3>
            <EditorButton
              aria-pressed={picking === "position"}
              onClick={() => onPicking(picking === "position" ? null : "position")}
            >
              <EditorIcon name="select" />
              Place on model
            </EditorButton>
          </div>
          {source.kind === "strip" && (
            <>
              <div className="lighting-type" role="group" aria-label="Strip endpoint">
                <EditorButton
                  aria-pressed={!selected.end}
                  onClick={() => onSelect({ index: selected.index })}
                >
                  Start
                </EditorButton>
                <EditorButton
                  aria-pressed={!!selected.end}
                  onClick={() => onSelect({ index: selected.index, end: true })}
                >
                  End
                </EditorButton>
                <EditorButton
                  variant="text"
                  onClick={() =>
                    updateSource({ ...fittedLightStrip(bounds), samples: source.samples })
                  }
                >
                  Fit along model
                </EditorButton>
              </div>
              <label>
                Samples along strip
                <input
                  aria-label="Strip sample count"
                  type="number"
                  min={2}
                  step={1}
                  value={source.samples}
                  onInput={(event) =>
                    updateSource({ ...source, samples: Number(event.currentTarget.value) })
                  }
                />
              </label>
              <p className="lighting-note">
                Requests finer coverage within the scene's shared budget. The strip keeps the same
                total brightness.
              </p>
              <EditorButton
                variant="text"
                onClick={() =>
                  updateSource({ ...source, samples: stripSamples(source.start, source.end) })
                }
              >
                Suggest sample count
              </EditorButton>
            </>
          )}
          <LightingCoordinates
            label={
              source.kind === "strip"
                ? selected.end
                  ? "End position"
                  : "Start position"
                : "Position"
            }
            position={sourcePosition(source, selected.end)}
            step={step}
            onStep={onStep}
            onChange={(position) => onChange(moveLightSource(light, selected, position))}
          />
          <p className="lighting-note">
            Drag the arrows in the preview to move. Focus the preview to nudge with arrow keys; Page
            Up / Down changes height. Hold Shift for 10× steps.
          </p>
        </section>
      )}
      <fieldset>
        <legend>
          Glowing surfaces <span className="lighting-count">{glowing}</span>
        </legend>
        <EditorButton
          aria-pressed={picking === "surface"}
          onClick={() => onPicking(picking === "surface" ? null : "surface")}
        >
          <EditorIcon name="select" />
          Choose in preview
        </EditorButton>
        <p className="lighting-note">
          Glow follows the connected light. It changes the surface appearance; the sources above
          light the room.
        </p>
        <details className="lighting-surfaces">
          <summary>Surface list</summary>
          {light.emissiveSurfaces
            ?.filter((id) => !surfaces.some((surface) => surface.id === id && surface.supported))
            .map((id) => (
              <label key={id} className="lighting-check">
                <input
                  type="checkbox"
                  checked
                  onChange={() =>
                    onChange({
                      ...light,
                      emissiveSurfaces: light.emissiveSurfaces!.filter((saved) => saved !== id),
                    })
                  }
                />
                {id} · Unavailable. Remove and choose the surface again.
              </label>
            ))}
          {surfaces.map((surface) => {
            const checked = !!light.emissiveSurfaces?.includes(surface.id);
            return (
              <label key={surface.id} className="lighting-check">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!surface.supported || (!checked && glowing >= 16)}
                  onChange={() =>
                    onChange({
                      ...light,
                      emissiveSurfaces: checked
                        ? light.emissiveSurfaces!.filter((id) => id !== surface.id)
                        : [...(light.emissiveSurfaces ?? []), surface.id],
                    })
                  }
                />
                {surface.label}
              </label>
            );
          })}
          {light.emissiveMaterials?.map((name) => (
            <label key={name} className="lighting-check">
              <input
                type="checkbox"
                checked
                onChange={() =>
                  onChange({
                    ...light,
                    emissiveMaterials: light.emissiveMaterials!.filter(
                      (material) => material !== name,
                    ),
                  })
                }
              />
              {name} (material)
            </label>
          ))}
          {!surfaces.some((surface) => surface.supported) && (
            <p className="lighting-note">No surfaces available for glow.</p>
          )}
          {surfaces.some((surface) => surface.id.startsWith("unavailable:")) && (
            <p className="lighting-note">Some model parts are unavailable for surface selection.</p>
          )}
        </details>
      </fieldset>
      <fieldset>
        <legend>Light output</legend>
        <label className="lighting-check">
          <input
            type="checkbox"
            checked={light.illuminate !== false}
            onChange={(event) => onChange({ ...light, illuminate: event.target.checked })}
          />
          Illuminate surroundings
        </label>
        <label>
          Default color
          <input
            aria-label="Default light color"
            type="color"
            value={light.color}
            onChange={(event) => onChange({ ...light, color: event.target.value })}
          />
        </label>
        <div className="lighting-output-fields">
          <label>
            Total brightness
            <input
              aria-label="Total brightness"
              type="number"
              min={0}
              step={0.1}
              value={light.maxIntensity}
              onChange={(event) => onChange({ ...light, maxIntensity: Number(event.target.value) })}
            />
          </label>
          <label>
            Range
            <LengthInput
              label="Light range"
              min={0}
              value={light.distance}
              onCommit={(distance) => onChange({ ...light, distance })}
            />
          </label>
        </div>
        <p className="lighting-note">
          Brightness is shared between sources. Connected lights supply their own color and
          brightness.
        </p>
      </fieldset>
    </div>
  );
}
