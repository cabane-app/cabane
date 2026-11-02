import { useCabaneDom } from "@cabane/engine";
import { useEffect, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Plane, Vector3 } from "three";
import {
  deriveStairFlight,
  stairFloorIds,
  planPointToWorld,
  worldPointToPlan,
  StairPlan,
  type ManifestIssue,
  type HomeProject,
  type StairSpec,
  type SnapTarget,
} from "@cabane/engine";
import {
  beginSelectDrag,
  resolveSelectDrag,
  type SelectDragActivation,
} from "../editor-preview/construct/select-drag-activation";
import {
  worldDragToConstructPlan,
  worldDragToSnappedConstructPlan,
} from "../editor-preview/construct/drag-geometry";
import { constructPixelsPerMeter } from "../editor-preview/construct/plan-screen-scale";
import { ConstructionOutlineHandle } from "../editor-preview/construct/ConstructionOutlineHandle";
import { ConstructionAlignmentGuide } from "../editor-preview/construct/ConstructionAlignmentGuide";
import {
  stairEditHandles,
  editStairFromPoint,
  type StairEditHandle,
  type StairPlacementPoint,
} from "./stair-placement-geometry";
import type { StairValidationRegistries } from "./stair-candidate-validation";
import { useStairValidation } from "./useStairValidation";
import { StairFeedback } from "./StairFeedback";
import { ConnectedFloorGuide } from "./ConnectedFloorGuide";
import { SelectedStairControls } from "./SelectedStairControls";

type Pointer = ThreeEvent<PointerEvent>;
type Target = {
  setPointerCapture(id: number): void;
  releasePointerCapture(id: number): void;
  hasPointerCapture(id: number): boolean;
};
type Drag = SelectDragActivation & {
  original: StairSpec;
  candidate: StairSpec;
  start: StairPlacementPoint;
  grab: StairPlacementPoint;
  handle: StairEditHandle;
  target: Target;
};

export function EditableStair({
  building,
  stair,
  activeFloorId,
  selected,
  enabled,
  registries,
  onIssuesChange,
  onSelect,
  onCommit,
  onDraggingChange,
  onGoToFloor,
  onDelete,
}: {
  building: HomeProject;
  stair: StairSpec;
  activeFloorId: string;
  selected: boolean;
  enabled: boolean;
  registries?: StairValidationRegistries;
  onIssuesChange?: ((issues: readonly ManifestIssue[] | null) => void) | undefined;
  onSelect: () => void;
  onCommit: (stair: StairSpec) => void;
  onDraggingChange: (value: boolean) => void;
  onGoToFloor: () => void;
  onDelete: () => void;
}) {
  const { camera, size, gl, get } = useThree();
  const lockedControls = useRef<{ enabled: boolean } | null>(null);
  const [draft, setDraft] = useState<StairSpec | null>(null);
  const [snap, setSnap] = useState<SnapTarget | null>(null);
  const active = useRef<Drag | null>(null);
  const candidate = draft ?? stair;
  const validation = useStairValidation(
    building,
    selected && enabled ? candidate : null,
    registries,
  );
  const hasDraft = Boolean(draft);
  useEffect(() => {
    onIssuesChange?.(selected && hasDraft ? validation.issues : null);
    return () => onIssuesChange?.(null);
  }, [onIssuesChange, selected, hasDraft, validation.issues]);
  const flight = deriveStairFlight(building, candidate);
  const latest = useRef({ onDraggingChange, validation });
  latest.current = { onDraggingChange, validation };
  const release = () => {
    const current = active.current;
    active.current = null;
    if (current?.target.hasPointerCapture(current.pointerId))
      current.target.releasePointerCapture(current.pointerId);
    setDraft(null);
    setSnap(null);
    latest.current.validation.cancel();
    if (lockedControls.current) {
      lockedControls.current.enabled = true;
      lockedControls.current = null;
    }
    if (current) latest.current.onDraggingChange(false);
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;
  const dom = useCabaneDom();
  useEffect(() => {
    if (!enabled || !selected) releaseRef.current();
  }, [enabled, selected, stair]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && active.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        releaseRef.current();
      }
    };
    const lost = (event: PointerEvent) => {
      if (active.current?.pointerId === event.pointerId) releaseRef.current();
    };
    dom.events.addEventListener("keydown", cancel, true);
    gl.domElement.addEventListener("lostpointercapture", lost);
    return () => {
      dom.events.removeEventListener("keydown", cancel, true);
      gl.domElement.removeEventListener("lostpointercapture", lost);
      releaseRef.current();
    };
  }, [gl, dom]);
  const project = (event: Pointer, current?: Drag): StairPlacementPoint | null => {
    const hit = event.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), new Vector3());
    if (!hit) return null;
    const coordinates = building.coordinates;
    const endpoint = current && (current.handle === "bottom" || current.handle === "top");
    const originalFlight = current && deriveStairFlight(building, current.original);
    const fixed =
      originalFlight &&
      (current?.handle === "bottom"
        ? originalFlight.path[originalFlight.path.length - 1]
        : originalFlight.path[0]);
    const point = endpoint
      ? worldDragToSnappedConstructPlan({
          point: hit,
          coordinates,
          walls: building.floors
            .filter((f) => stairFloorIds(stair).includes(f.id))
            .flatMap((f) => f.walls),
          onSnap: setSnap,
          pixelsPerMeter: constructPixelsPerMeter(camera, size.height),
          pointerType: event.nativeEvent.pointerType,
          absolute: event.altKey,
          angleOrigin: fixed ? worldPointToPlan(fixed, coordinates) : undefined,
        })
      : worldDragToConstructPlan({ point: hit, coordinates, absolute: event.altKey });
    const [x, z] = planPointToWorld(point, coordinates);
    return { x, z };
  };
  const update = (event: Pointer, current: Drag) => {
    const point = project(event, current);
    return point
      ? editStairFromPoint(
          current.original,
          building.coordinates,
          current.start,
          current.grab,
          point,
          current.handle,
        )
      : null;
  };
  const handlers = (handle: StairEditHandle) => ({
    onPointerDown: (event: Pointer) => {
      if (
        !enabled ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        active.current
      )
        return;
      const grab = project(event);
      if (!grab || !flight) return;
      event.stopPropagation();
      onSelect();
      const controls = get().controls as unknown as { enabled: boolean } | null;
      if (controls?.enabled) {
        controls.enabled = false;
        lockedControls.current = controls;
      }
      onDraggingChange(true);
      const target = event.target as unknown as Target;
      target.setPointerCapture(event.pointerId);
      active.current = {
        ...beginSelectDrag(event.pointerId, [event.nativeEvent.clientX, event.nativeEvent.clientY]),
        original: stair,
        candidate: stair,
        start: { x: flight.originWorld[0], z: flight.originWorld[1] },
        grab,
        handle,
        target,
      };
    },
    onPointerMove: (event: Pointer) => {
      const current = active.current;
      if (!current || current.pointerId !== event.pointerId) return;
      event.stopPropagation();
      const resolved = resolveSelectDrag(current, event.pointerId, [
        event.nativeEvent.clientX,
        event.nativeEvent.clientY,
      ]);
      if (!resolved) return;
      if (resolved.started) onDraggingChange(true);
      const next = update(event, resolved.drag) ?? resolved.drag.candidate;
      active.current = { ...resolved.drag, candidate: next };
      setDraft(next);
    },
    onPointerUp: (event: Pointer) => {
      const current = active.current;
      if (!current || current.pointerId !== event.pointerId) return;
      event.stopPropagation();
      const rect = gl.domElement.getBoundingClientRect();
      const inside =
        event.nativeEvent.clientX >= rect.left &&
        event.nativeEvent.clientX <= rect.right &&
        event.nativeEvent.clientY >= rect.top &&
        event.nativeEvent.clientY <= rect.bottom;
      const next =
        current.dragActive && inside ? (update(event, current) ?? current.candidate) : null;
      if (next) {
        validation.flush(next);
        onCommit(next);
      }
      release();
    },
    onPointerCancel: (event: Pointer) => {
      if (active.current?.pointerId === event.pointerId) {
        event.stopPropagation();
        release();
      }
    },
  });
  if (!flight) return null;
  const other = building.floors.find(
    (f) =>
      f.id === (activeFloorId === stair.lowerFloorId ? stair.upperFloorId : stair.lowerFloorId),
  );
  return (
    <group name={`editable-stair-${stair.id}`}>
      {draft && other && <ConnectedFloorGuide floor={other} />}
      <StairPlan
        flight={flight}
        upper={activeFloorId === flight.upperFloorId}
        selected={selected}
        invalid={validation.issues.some((issue) => issue.severity !== "warning")}
        handlers={enabled ? handlers("body") : undefined}
      />
      <ConstructionAlignmentGuide snap={snap} coordinates={building.coordinates} />
      {selected && (
        <>
          {stairEditHandles(flight).map(({ handle, at }) => (
            <ConstructionOutlineHandle
              key={handle}
              name={`stair-${handle}-${stair.id}`}
              handlers={handlers(handle)}
              at={at}
            />
          ))}
          {draft && <StairFeedback flight={flight} />}
          {!draft && (
            <SelectedStairControls
              flight={flight}
              destinationName={other?.name ?? "Ground"}
              onGoToFloor={other ? onGoToFloor : undefined}
              onDelete={onDelete}
            />
          )}
        </>
      )}
    </group>
  );
}
