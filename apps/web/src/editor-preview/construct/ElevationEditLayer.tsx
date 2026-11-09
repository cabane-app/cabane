import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { DoubleSide, Vector3 } from "three";
import {
  createFloorFinishGeometry,
  formatLength,
  planPointToWorld,
  polygonSignedArea,
  transitionOutline,
  useMeasurementUnits,
  useCabaneDom,
  type ElevationSettings,
  type Polygon,
} from "@cabane/engine";
import type { ConstructEditorController } from "./construct-controller-contract";
import { areaElevation, withEdgeTransition } from "./elevation-editing";
import "./elevation-controls.css";

type Area = { id: string; polygon: Polygon; elevation?: ElevationSettings; indoor: boolean };

function Edge({
  from,
  to,
  selected,
  onSelect,
}: {
  from: [number, number, number];
  to: [number, number, number];
  selected: boolean;
  onSelect?: () => void;
}) {
  const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
  return (
    <group
      position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]}
      rotation={[0, -Math.atan2(to[2] - from[2], to[0] - from[0]), 0]}
    >
      <mesh renderOrder={20}>
        <boxGeometry args={[length, 0.018, selected ? 0.035 : 0.018]} />
        <meshBasicMaterial color={selected ? "#bd724d" : "#958570"} depthTest={false} />
      </mesh>
      {onSelect && (
        <mesh
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          <boxGeometry args={[length, 0.12, 0.16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function EditableArea({
  area,
  editor,
  plan,
  level,
  onDraggingChange,
}: {
  area: Area;
  editor: ConstructEditorController;
  plan: boolean;
  level: number;
  onDraggingChange: (value: boolean) => void;
}) {
  const { camera, size } = useThree();
  const dom = useCabaneDom();
  const units = useMeasurementUnits();
  const selected = editor.selection?.kind !== "multiple" && editor.selection?.id === area.id;
  const selectedEdge =
    editor.selectedElevationEdge?.areaId === area.id ? editor.selectedElevationEdge.index : null;
  const settings = areaElevation(area.id, area.polygon, area.elevation);
  const [preview, setPreview] = useState<ElevationSettings | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    dx: number;
    dy: number;
    value: number;
    kind: "height" | "width";
    settings: ElevationSettings;
  } | null>(null);
  const current = preview ?? settings;
  const coordinates = editor.previewFloor.coordinates;
  const height = plan ? 0.2 : level + current.offsetMeters + 0.025;
  const geometry = useMemo(
    () => createFloorFinishGeometry(area.polygon, coordinates, 1),
    [area.polygon, coordinates],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const world = area.polygon.map((p) => planPointToWorld(p, coordinates));
  const center: [number, number, number] = [
    world.reduce((n, p) => n + p[0], 0) / world.length,
    height,
    world.reduce((n, p) => n + p[1], 0) / world.length,
  ];
  const update = (value: ElevationSettings) =>
    area.indoor
      ? editor.updateFloorZone(area.id, { elevation: value })
      : editor.updatePlatform(area.id, { elevation: value });
  const cancel = () => {
    drag.current = null;
    setPreview(null);
    onDraggingChange(false);
  };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && drag.current) {
        event.preventDefault();
        cancel();
      }
    };
    dom.events.addEventListener("keydown", escape);
    return () => dom.events.removeEventListener("keydown", escape);
  });
  const start = (
    event: ReactPointerEvent<HTMLButtonElement>,
    kind: "height" | "width",
    origin: [number, number, number],
    axis: [number, number, number],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    const a = new Vector3(...origin).project(camera),
      b = new Vector3(origin[0] + axis[0], origin[1] + axis[1], origin[2] + axis[2]).project(
        camera,
      );
    const transition = selectedEdge === null ? undefined : settings.edges[selectedEdge]?.transition;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      dx: ((b.x - a.x) * size.width) / 2,
      dy: (-(b.y - a.y) * size.height) / 2,
      value:
        kind === "height"
          ? settings.offsetMeters
          : transition?.kind === "sloped"
            ? transition.widthMeters
            : 1,
      kind,
      settings,
    };
    onDraggingChange(true);
  };
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const denominator = d.dx * d.dx + d.dy * d.dy;
    if (denominator < 1) return;
    const value =
      Math.round(
        (d.value + ((event.clientX - d.x) * d.dx + (event.clientY - d.y) * d.dy) / denominator) *
          100,
      ) / 100;
    setPreview(
      d.kind === "height"
        ? { ...d.settings, offsetMeters: value }
        : withEdgeTransition(d.settings, selectedEdge, {
            kind: "sloped",
            widthMeters: Math.max(0.05, value),
          }),
    );
  };
  const end = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (preview) update(preview);
    cancel();
  };
  const handle = (
    kind: "height" | "width",
    origin: [number, number, number],
    axis: [number, number, number],
    value: number,
  ) => (
    <Html center position={origin} zIndexRange={[30, 20]}>
      <button
        className="elevation-drag-handle"
        data-axis={kind}
        type="button"
        aria-label={kind === "height" ? "Drag area height" : "Drag slope width"}
        title="Drag to adjust. Arrow keys change by 1 cm. Escape cancels."
        onPointerDown={(event) => start(event, kind, origin, axis)}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={cancel}
        onKeyDown={(event) => {
          if (event.key === "Escape" && drag.current) {
            event.preventDefault();
            event.stopPropagation();
            cancel();
            return;
          }
          if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) {
            event.preventDefault();
            const next = value + (["ArrowUp", "ArrowRight"].includes(event.key) ? 0.01 : -0.01);
            update(
              kind === "height"
                ? { ...settings, offsetMeters: next }
                : withEdgeTransition(settings, selectedEdge, {
                    kind: "sloped",
                    widthMeters: Math.max(0.05, next),
                  }),
            );
          }
        }}
      >
        <svg viewBox="0 0 16 24" aria-hidden="true">
          <path d="M8 2v20M3 7l5-5 5 5M3 17l5 5 5-5" />
        </svg>
        {kind === "height" ? "Level" : "Width"} {formatLength(value, units)}
      </button>
    </Html>
  );
  const outline = transitionOutline(
    { id: area.id, polygon: area.polygon, elevation: current },
    coordinates.metersPerPlanUnit,
  );
  let widthHandle = null;
  if (selectedEdge !== null && current.edges[selectedEdge]?.transition?.kind === "sloped") {
    const i = selectedEdge,
      j = (i + 1) % world.length,
      a = world[i],
      b = world[j],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      sign = Math.sign(polygonSignedArea(area.polygon));
    const axis: [number, number, number] = [
      (sign * (b[1] - a[1])) / len,
      0,
      (-sign * (b[0] - a[0])) / len,
    ];
    const c = planPointToWorld(outline[i], coordinates),
      d = planPointToWorld(outline[j], coordinates);
    const t = current.edges[i].transition;
    if (t?.kind === "sloped")
      widthHandle = handle(
        "width",
        [
          (c[0] + d[0]) / 2,
          plan ? 0.22 : level + (area.indoor ? 0 : -0.05) + 0.06,
          (c[1] + d[1]) / 2,
        ],
        axis,
        t.widthMeters,
      );
  }
  return (
    <group>
      {!plan && (
        <mesh
          geometry={geometry}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, height, 0]}
          onPointerDown={(event) => {
            event.stopPropagation();
            editor.selectElevationEdge(area.id, null);
          }}
        >
          <meshBasicMaterial
            transparent
            opacity={preview?.offsetMeters !== undefined ? 0.2 : 0}
            color="#bd724d"
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {selected &&
        world.map((p, i) => (
          <Edge
            key={settings.edges[i]?.id ?? i}
            from={[p[0], height, p[1]]}
            to={[world[(i + 1) % world.length][0], height, world[(i + 1) % world.length][1]]}
            selected={selectedEdge === null || selectedEdge === i}
            onSelect={() => editor.selectElevationEdge(area.id, i)}
          />
        ))}
      {selected &&
        current.edges.map((edge, i) => {
          if (edge.transition?.kind !== "sloped") return null;
          const a = planPointToWorld(outline[i], coordinates),
            b = planPointToWorld(outline[(i + 1) % outline.length], coordinates),
            y = plan ? 0.21 : level + (area.indoor ? 0 : -0.05) + 0.03;
          return (
            <Edge
              key={`slope-${edge.id}`}
              from={[a[0], y, a[1]]}
              to={[b[0], y, b[1]]}
              selected={selectedEdge === i}
              onSelect={() => editor.selectElevationEdge(area.id, i)}
            />
          );
        })}
      {selected &&
        !plan &&
        handle("height", [center[0], height + 0.5, center[2]], [0, 1, 0], current.offsetMeters)}
      {selected && widthHandle}
    </group>
  );
}

export function ElevationEditLayer({
  editor,
  plan,
  level = 0,
  onDraggingChange,
}: {
  editor: ConstructEditorController;
  plan: boolean;
  level?: number;
  onDraggingChange: (value: boolean) => void;
}) {
  const areas: Area[] = [
    ...editor.previewFloor.rooms.flatMap((room) =>
      (room.floorZones ?? [])
        .filter((zone) => zone.elevation)
        .map((zone) => ({ ...zone, indoor: true })),
    ),
    ...(editor.previewFloor.outdoorPlatforms ?? []).map((platform) => ({
      ...platform,
      indoor: false,
    })),
  ];
  return (
    <group name="elevation-editor">
      {areas.map((area) => (
        <EditableArea
          key={area.id}
          area={area}
          editor={editor}
          plan={plan}
          level={level}
          onDraggingChange={onDraggingChange}
        />
      ))}
    </group>
  );
}
