import { omitUndefinedProperties } from "@cabane/engine";
import { useCabaneDom } from "@cabane/engine";
import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import {
  planPointToWorld,
  worldPointToPlan,
  deriveStairFlight,
  stairFloorIds,
  connectStairToTerrain,
  StairPlan,
  type ManifestIssue,
  type FloorCoordinates,
  type HomeProject,
  type StairSpec,
  type SnapTarget,
} from "@cabane/engine";
import { worldDragToSnappedConstructPlan } from "../editor-preview/construct/drag-geometry";
import { constructPixelsPerMeter } from "../editor-preview/construct/plan-screen-scale";
import {
  beginSegmentPress,
  segmentPressAnchors,
  type SegmentPress,
} from "../editor-preview/construct/segment-gesture";
import { ConstructionAlignmentGuide } from "../editor-preview/construct/ConstructionAlignmentGuide";
import {
  stairFromCorner,
  stairFromEndpoints,
  type StairPlacementPoint,
} from "./stair-placement-geometry";
import type { StairValidationRegistries } from "./stair-candidate-validation";
import { useStairValidation } from "./useStairValidation";
import { StairFeedback } from "./StairFeedback";
import { ConnectedFloorGuide } from "./ConnectedFloorGuide";

export function StairPlacement({
  stair,
  coordinates,
  building,
  registries,
  onIssuesChange,
  onComplete,
  onCancel,
  onDraggingChange,
}: {
  stair: StairSpec;
  coordinates: FloorCoordinates;
  building: HomeProject;
  registries?: StairValidationRegistries;
  onIssuesChange?: ((issues: readonly ManifestIssue[] | null) => void) | undefined;
  onComplete: (stair: StairSpec) => void;
  onCancel: () => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const { gl, camera } = useThree();
  const [candidate, setCandidate] = useState<StairSpec | null>(null);
  const [snap, setSnap] = useState<SnapTarget | null>(null);
  const validation = useStairValidation(building, candidate, registries);
  useEffect(() => {
    onIssuesChange?.(validation.issues);
    return () => onIssuesChange?.(null);
  }, [onIssuesChange, validation.issues]);
  const latest = useRef({
    stair,
    coordinates,
    building,
    onComplete,
    onCancel,
    onDraggingChange,
    validation,
  });
  latest.current = {
    stair,
    coordinates,
    building,
    onComplete,
    onCancel,
    onDraggingChange,
    validation,
  };
  const flight = candidate ? deriveStairFlight(building, candidate) : null;
  const dom = useCabaneDom();
  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new Raycaster();
    const plane = new Plane(new Vector3(0, 1, 0), 0);
    let anchor: StairPlacementPoint | null = null;
    let corner: StairPlacementPoint | null = null;
    let pointer: number | null = null;
    let press: SegmentPress | null = null;
    const project = (event: PointerEvent) => {
      const { building, stair, coordinates } = latest.current;
      const rect = canvas.getBoundingClientRect();
      raycaster.setFromCamera(
        new Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((event.clientY - rect.top) / rect.height) * 2,
        ),
        camera,
      );
      const hit = raycaster.ray.intersectPlane(plane, new Vector3());
      if (!hit) return null;
      const walls = building.floors
        .filter((f) => stairFloorIds(stair).includes(f.id))
        .flatMap((f) => f.walls);
      const point = worldDragToSnappedConstructPlan(
        omitUndefinedProperties({
          point: hit,
          coordinates,
          walls,
          onSnap: setSnap,
          pixelsPerMeter: constructPixelsPerMeter(camera, rect.height),
          pointerType: event.pointerType,
          absolute: event.altKey,
          angleOrigin:
            (corner ?? anchor) ? worldPointToPlan((corner ?? anchor)!, coordinates) : undefined,
        }),
      );
      const [x, z] = planPointToWorld(point, coordinates);
      return { x, z };
    };
    const preview = (point: StairPlacementPoint) => {
      if (!anchor) return null;
      const source = latest.current.stair;
      const drawn =
        corner && (source.shape === "l-shaped" || source.shape === "u-shaped")
          ? stairFromCorner(source, latest.current.coordinates, anchor, corner, point)
          : stairFromEndpoints(source, latest.current.coordinates, anchor, point);
      const next = drawn ? connectStairToTerrain(latest.current.building, drawn) : null;
      setCandidate(next);
      return next;
    };
    const release = () => {
      const id = pointer;
      pointer = null;
      if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      latest.current.onDraggingChange(false);
    };
    const cancel = () => {
      release();
      latest.current.validation.cancel();
      latest.current.onCancel();
    };
    const down = (event: PointerEvent) => {
      event.stopImmediatePropagation();
      if (
        event.button !== 0 ||
        pointer !== null ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey
      )
        return;
      const point = project(event);
      if (!point) return;
      event.preventDefault();
      press = beginSegmentPress(
        event.pointerId,
        [event.clientX, event.clientY],
        worldPointToPlan(point, latest.current.coordinates),
        Boolean(anchor),
      );
      anchor ??= point;
      pointer = event.pointerId;
      canvas.setPointerCapture(pointer);
      latest.current.onDraggingChange(true);
      preview(point);
    };
    const move = (event: PointerEvent) => {
      event.stopImmediatePropagation();
      if (!anchor || (pointer !== null && pointer !== event.pointerId)) return;
      const point = project(event);
      if (point) preview(point);
    };
    const up = (event: PointerEvent) => {
      event.stopImmediatePropagation();
      if (pointer !== event.pointerId) return;
      const anchorOnly = segmentPressAnchors(press, event.pointerId, [
        event.clientX,
        event.clientY,
      ]);
      const rect = canvas.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        cancel();
        return;
      }
      const point = project(event);
      release();
      if (anchorOnly) {
        setCandidate(null);
        return;
      }
      const next = point && preview(point);
      if (!next) return;
      if (
        (latest.current.stair.shape === "l-shaped" || latest.current.stair.shape === "u-shaped") &&
        !corner
      ) {
        corner = point;
        setSnap(null);
        return;
      }
      latest.current.validation.flush(next);
      latest.current.onComplete(next);
    };
    const interrupted = (event: PointerEvent) => {
      if (pointer === event.pointerId) cancel();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    };
    canvas.addEventListener("pointerdown", down, true);
    canvas.addEventListener("pointermove", move, true);
    canvas.addEventListener("pointerup", up, true);
    canvas.addEventListener("pointercancel", interrupted, true);
    canvas.addEventListener("lostpointercapture", interrupted, true);
    dom.events.addEventListener("keydown", key, true);
    return () => {
      canvas.removeEventListener("pointerdown", down, true);
      canvas.removeEventListener("pointermove", move, true);
      canvas.removeEventListener("pointerup", up, true);
      canvas.removeEventListener("pointercancel", interrupted, true);
      canvas.removeEventListener("lostpointercapture", interrupted, true);
      dom.events.removeEventListener("keydown", key, true);
      release();
    };
  }, [gl, camera, dom]);
  const other = building.floors.find((f) => f.id === stair.upperFloorId);
  return (
    <group name="stair-placement-preview">
      {other && <ConnectedFloorGuide floor={other} />}
      <ConstructionAlignmentGuide snap={snap} coordinates={coordinates} />
      {flight && (
        <>
          <StairPlan
            flight={flight}
            invalid={validation.issues.some((issue) => issue.severity !== "warning")}
          />
          <StairFeedback flight={flight} />
        </>
      )}
    </group>
  );
}
