import { Canvas } from "@react-three/fiber";
import { useState, type KeyboardEvent } from "react";
import { modelLightSources } from "@cabane/engine";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { LightingStageScene, type LightingSceneProps } from "./LightingStageScene";
import { sourceLabel, sourcePosition } from "./lighting-layout";
import type { LightingView } from "./LightingCamera";

export function LightingStage(props: LightingSceneProps & { step: number }) {
  const [request, setRequest] = useState<{ view: LightingView; key: number }>({
    view: "3D",
    key: 0,
  });
  const [throughGlass, setThroughGlass] = useState(true);
  const [markers, setMarkers] = useState(true);
  const [rotate, setRotate] = useState(false);
  const [night, setNight] = useState(false);
  const span = Math.max(...props.bounds.max.map((n, i) => n - props.bounds.min[i]));
  const sources = props.light ? modelLightSources(props.light) : [];
  const source = sources[props.selected.index];
  const view = (view: LightingView) => setRequest((request) => ({ view, key: request.key + 1 }));
  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      props.disabled ||
      !source ||
      (event.target !== event.currentTarget && (event.target as HTMLElement).tagName !== "CANVAS")
    )
      return;
    const movements: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [2, -1],
      ArrowDown: [2, 1],
      PageUp: [1, 1],
      PageDown: [1, -1],
    };
    const movement = movements[event.key];
    if (!movement) return;
    event.preventDefault();
    event.stopPropagation();
    const point = sourcePosition(source, props.selected.end);
    props.onPosition(
      point.map((n, axis) =>
        axis === movement[0]
          ? Number((n + movement[1] * props.step * (event.shiftKey ? 10 : 1)).toFixed(6))
          : n,
      ) as [number, number, number],
    );
  };
  const label = source
    ? sourceLabel(sources, props.selected.index).toLowerCase() +
      (source.kind === "strip" ? (props.selected.end ? " end" : " start") : "")
    : "source";
  return (
    <>
      <div
        className="lighting-stage"
        data-picking={props.picking ?? "orbit"}
        tabIndex={0}
        aria-label="Interactive lighting preview"
        onKeyDown={nudge}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).tagName === "CANVAS")
            event.currentTarget.focus({ preventScroll: true });
        }}
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          camera={{
            fov: 40,
            position: [span * 1.8, span * 1.4, span * 2],
            near: Math.max(0.001, span / 1000),
            far: Math.max(100, span * 100),
          }}
        >
          <LightingStageScene
            {...props}
            throughGlass={throughGlass}
            markers={markers}
            night={night}
            request={request}
            rotate={rotate}
          />
        </Canvas>
        <div className="lighting-view-tools" role="group" aria-label="Preview camera">
          {(["3D", "Top", "Front", "Side"] as const).map((name) => (
            <EditorButton
              key={name}
              aria-pressed={request.view === name}
              disabled={props.disabled}
              onClick={() => view(name)}
            >
              {name}
            </EditorButton>
          ))}
          <EditorButton
            aria-label="Fit model in preview"
            title="Fit model"
            disabled={props.disabled}
            onClick={() => view("Fit")}
          >
            <EditorIcon name="resize" />
          </EditorButton>
          <EditorButton disabled={!source || props.disabled} onClick={() => view("Focus")}>
            Focus source
          </EditorButton>
        </div>
        <p className="lighting-stage__hint" role="status">
          {props.picking === "surface"
            ? "Click a surface to add or remove glow."
            : props.picking === "position"
              ? "Place " + label + " · Click the model."
              : "Drag to pan · Right-drag to orbit · Scroll to zoom"}
        </p>
      </div>
      <div className="lighting-preview-options">
        {source?.kind === "strip" && (
          <EditorButton aria-pressed={rotate} onClick={() => setRotate(!rotate)}>
            <EditorIcon name={rotate ? "move" : "rotateRight"} />
            {rotate ? "Move endpoint" : "Rotate strip"}
          </EditorButton>
        )}

        <label>
          <input
            type="checkbox"
            checked={throughGlass}
            onChange={(event) => setThroughGlass(event.target.checked)}
          />
          Pick through glass
        </label>
        <label>
          <input
            type="checkbox"
            checked={markers}
            onChange={(event) => setMarkers(event.target.checked)}
          />
          Show handles
        </label>
        <label>
          <input
            type="checkbox"
            checked={night}
            onChange={(event) => setNight(event.target.checked)}
          />
          Night preview
        </label>
      </div>
    </>
  );
}
