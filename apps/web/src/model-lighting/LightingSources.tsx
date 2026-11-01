import {
  modelLightSources,
  type CustomModelLight,
  type DeviceModelBounds,
  type ModelVector,
} from "@cabane/engine";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import {
  fittedLightStrip,
  sourceLabel,
  sourcePosition,
  withLightSources,
  type LightingSelection,
} from "./lighting-layout";

export function LightingSources({
  light,
  bounds,
  selected,
  onChange,
  onSelect,
}: {
  light: CustomModelLight;
  bounds: DeviceModelBounds;
  selected: LightingSelection;
  onChange: (light: CustomModelLight) => void;
  onSelect: (selection: LightingSelection) => void;
}) {
  const sources = modelLightSources(light);
  const add = (strip: boolean) => {
    const position = sources[selected.index]
      ? sourcePosition(sources[selected.index])
      : light.position;
    onChange(
      withLightSources(light, [
        ...sources,
        strip
          ? fittedLightStrip(bounds)
          : {
              kind: "point",
              position: [position[0] + 0.05, position[1], position[2]],
            },
      ]),
    );
    onSelect({ index: sources.length });
  };
  return (
    <fieldset>
      <legend>
        Light sources <span className="lighting-count">{sources.length}</span>
      </legend>
      <div className="lighting-source-list" role="group" aria-label="Light sources">
        {sources.map((source, index) => (
          <div key={index} className="lighting-source-row" data-selected={selected.index === index}>
            <EditorButton
              aria-pressed={selected.index === index}
              onClick={() => onSelect({ index })}
            >
              <EditorIcon name={source.kind === "point" ? "lighting" : "minus"} />
              <span>{sourceLabel(sources, index)}</span>
              <small>{source.kind === "strip" ? source.samples + " samples" : "Point"}</small>
            </EditorButton>
            <EditorButton
              variant="text"
              aria-label={"Remove " + sourceLabel(sources, index).toLowerCase()}
              onClick={() => {
                onChange(
                  withLightSources(
                    light,
                    sources.filter((_source, i) => i !== index),
                  ),
                );
                onSelect({
                  index: Math.max(0, selected.index - (index <= selected.index ? 1 : 0)),
                });
              }}
            >
              <EditorIcon name="delete" />
            </EditorButton>
          </div>
        ))}
      </div>
      {!sources.length && (
        <p className="lighting-note">
          Add a point or strip to illuminate the scene. Surface glow works on its own.
        </p>
      )}
      <div className="lighting-source-actions">
        <EditorButton onClick={() => add(false)}>
          <EditorIcon name="plus" />
          Add point
        </EditorButton>
        <EditorButton onClick={() => add(true)}>
          <EditorIcon name="plus" />
          Add LED strip
        </EditorButton>
      </div>
      {sources[selected.index] && (
        <EditorButton
          variant="text"
          onClick={() => {
            const source = sources[selected.index];
            const offset = (point: ModelVector) => [point[0], point[1] + 0.1, point[2]] as const;
            const copy =
              source.kind === "point"
                ? { ...source, position: offset(source.position) }
                : { ...source, start: offset(source.start), end: offset(source.end) };
            onChange(withLightSources(light, [...sources, copy]));
            onSelect({ index: sources.length });
          }}
        >
          Duplicate source
        </EditorButton>
      )}
    </fieldset>
  );
}
