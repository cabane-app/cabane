import { omitUndefinedProperties } from "@cabane/engine";
import { ConstructionAlignmentGuide } from "./ConstructionAlignmentGuide";
import { ConstructionOutlineMeasurements } from "./ConstructionOutlineMeasurements";
import { useConstructionOutlineDrag } from "./useConstructionOutlineDrag";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  createFloorFinishGeometry,
  floorEditorSelectionIncludes,
  floorZonePointWithinRoom,
  groundZonePointOutsideFootprint,
  isFloorZoneOutline,
  planPointToWorld,
  type FloorEditorDraft,
  type FloorEditorSelection,
  type FloorEditorSelectionTarget,
  type FloorEditorTool,
  type FloorSpec,
  type PlanPoint,
  type Polygon,
} from "@cabane/engine";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, type Group } from "three";
import { ConstructionPointMarker } from "./ConstructionPointMarker";
import { noPlanRaycast, PlanOverlayMaterial, PlanStroke } from "./PlanDrawing";
import { PlanStrokeBatch } from "./PlanStrokeBatch";
import { constructPixelsPerMeter } from "./plan-screen-scale";
type Pointer = ThreeEvent<PointerEvent>;
type ZonePointerHandlers = {
  onPointerDown: (event: Pointer) => void;
  onPointerMove: (event: Pointer) => void;
  onPointerUp: (event: Pointer) => void;
  onPointerCancel: (event: Pointer) => void;
};

export const translateFloorZone = (polygon: Polygon, from: PlanPoint, to: PlanPoint): Polygon =>
  polygon.map((point) => [
    Number((point[0] + to[0] - from[0]).toFixed(4)),
    Number((point[1] + to[1] - from[1]).toFixed(4)),
  ]) as unknown as Polygon;

export const moveFloorZoneCorner = (polygon: Polygon, corner: number, to: PlanPoint): Polygon =>
  polygon.map((point, index) => (index === corner ? to : point)) as unknown as Polygon;

function FloorZoneCorner({
  at,
  name,
  handlers,
}: {
  at: [number, number, number];
  name: string;
  handlers: ZonePointerHandlers;
}) {
  const ref = useRef<Group>(null);
  useFrame(({ camera, size }) => {
    ref.current?.scale.setScalar(1 / constructPixelsPerMeter(camera, size.height));
  });
  return (
    <group ref={ref} position={at}>
      <mesh name={name} {...handlers}>
        <sphereGeometry args={[22, 12, 8]} />
        <PlanOverlayMaterial visible={false} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh raycast={noPlanRaycast} renderOrder={42}>
        <sphereGeometry args={[6, 12, 8]} />
        <PlanOverlayMaterial color="#fff7f1" depthTest={false} />
      </mesh>
    </group>
  );
}

function FloorHit({
  floor,
  polygon,
  name,
  elevation,
  selected,
  handlers,
}: {
  floor: FloorSpec;
  polygon: Polygon;
  name: string;
  elevation: number;
  selected?: boolean;
  handlers?: Partial<ZonePointerHandlers> | undefined;
}) {
  const geometry = useMemo(
    () =>
      isFloorZoneOutline(polygon) ? createFloorFinishGeometry(polygon, floor.coordinates, 1) : null,
    [floor.coordinates, polygon],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh
      name={name}
      geometry={geometry}
      position={[0, elevation, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={selected ? 41 : 40}
      {...handlers}
      {...(!handlers ? { raycast: noPlanRaycast } : {})}
    >
      <PlanOverlayMaterial
        color="#ff754d"
        transparent
        {...omitUndefinedProperties({ visible: selected })}
        opacity={selected ? 0.12 : 0}
        depthTest={false}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

export interface ConstructionFloorLayerProps {
  draft: FloorEditorDraft;
  floor: FloorSpec;
  selection: FloorEditorSelection;
  deletionTargets?: readonly FloorEditorSelectionTarget[];
  tool: FloorEditorTool;
  paintTarget: import("./floor-painting-contract").FloorPaintTarget;
  drawingPoints: readonly PlanPoint[];
  drawingPreview: PlanPoint | null;
  drawingRoomId: string | null;
  onPaintRoom: (roomId: string) => void;
  onSelectZone: (zoneId: string) => void;
  onUpdateZone: (zoneId: string, polygon: Polygon) => void;
  onDraggingChange?: (dragging: boolean) => void;
}

export function ConstructionFloorLayer({
  draft,
  floor,
  selection,
  deletionTargets,
  tool,
  paintTarget,
  drawingPoints,
  drawingPreview,
  drawingRoomId,
  onPaintRoom,
  onSelectZone,
  onUpdateZone,
  onDraggingChange,
}: ConstructionFloorLayerProps) {
  const { snap, drag, handlers } = useConstructionOutlineDrag({
    draft,
    selection,
    selectionKind: "floor-zone",
    tool,
    onSelect: onSelectZone,
    onUpdate: onUpdateZone,
    ...(onDraggingChange === undefined ? {} : { onDraggingChange: onDraggingChange }),
  });
  const lockedRoom = floor.rooms.find((room) => room.id === drawingRoomId);
  const previewValid =
    !drawingPreview || !lockedRoom
      ? !drawingPreview || groundZonePointOutsideFootprint(drawingPreview, floor)
      : floorZonePointWithinRoom(drawingPreview, lockedRoom.polygon);
  const pending =
    drawingPreview && drawingPoints.length ? [...drawingPoints, drawingPreview] : drawingPoints;
  const zones = [
    ...(floor.groundZones ?? []),
    ...floor.rooms.flatMap((room) => room.floorZones ?? []),
  ];
  return (
    <group name="construction-floors">
      <ConstructionAlignmentGuide snap={snap} coordinates={draft.coordinates} />
      {drag?.dragActive && (
        <ConstructionOutlineMeasurements
          polygon={drag.polygon}
          corner={drag.corner}
          coordinates={draft.coordinates}
          labelKind="Floor edge"
        />
      )}
      {tool === "floor" &&
        paintTarget === "room" &&
        floor.rooms.map((room) => (
          <FloorHit
            key={room.id}
            floor={floor}
            polygon={room.polygon}
            name={`construction-floor-room-${room.id}`}
            elevation={0.09}
            handlers={{
              onPointerDown: (event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.stopPropagation();
                onPaintRoom(room.id);
              },
            }}
          />
        ))}
      {[...zones].reverse().map((zone, reverseIndex) => {
        const polygon = drag?.id === zone.id ? drag.polygon : zone.polygon;
        const selected = deletionTargets
          ? deletionTargets.some((target) => target.kind === "floor-zone" && target.id === zone.id)
          : floorEditorSelectionIncludes(selection, "floor-zone", zone.id);
        const editable = selection?.kind === "floor-zone" && selection.id === zone.id;
        const valid = isFloorZoneOutline(polygon);
        return (
          <group key={zone.id} name={`plan-floor-zone-${zone.id}`}>
            <FloorHit
              floor={floor}
              polygon={polygon}
              name={`floor-zone-hit-${zone.id}`}
              elevation={0.12 + (zones.length - reverseIndex) * 0.0001}
              selected={selected}
              handlers={tool === "select" ? handlers(zone.id, polygon) : undefined}
            />
            <PlanStrokeBatch
              name="floor-zone-outline"
              strokes={polygon.map((from, index) => ({
                from: planPointToWorld(from, draft.coordinates),
                to: planPointToWorld(polygon[(index + 1) % polygon.length], draft.coordinates),
                color: !valid ? "#c53f32" : selected ? "#ff754d" : "#8d8b80",
                width: selected ? 0.055 : 0.018,
                elevation: 0.14,
              }))}
            />
            {editable &&
              tool === "select" &&
              polygon.map((point, index) => {
                const [x, z] = planPointToWorld(point, draft.coordinates);
                return (
                  <FloorZoneCorner
                    key={index}
                    name={`floor-zone-corner-${zone.id}-${index}`}
                    at={[x, 0.18, z]}
                    handlers={handlers(zone.id, zone.polygon, index)}
                  />
                );
              })}
          </group>
        );
      })}
      {tool === "floor" && paintTarget === "custom-area" && (
        <group name="construction-floor-draft">
          {pending.slice(1).map((point, index) => (
            <PlanStroke
              key={index}
              from={planPointToWorld(pending[index], draft.coordinates)}
              to={planPointToWorld(point, draft.coordinates)}
              color={previewValid ? "#ff754d" : "#c53f32"}
              width={0.055}
              elevation={0.18}
            />
          ))}
          {drawingPoints.map((point, index) => {
            const [x, z] = planPointToWorld(point, draft.coordinates);
            return (
              <ConstructionPointMarker
                key={index}
                name={`construction-floor-point-${index}`}
                position={[x, 0.2, z]}
                planMode
                radiusPixels={index === 0 ? 9 : 4}
              />
            );
          })}
        </group>
      )}
    </group>
  );
}
