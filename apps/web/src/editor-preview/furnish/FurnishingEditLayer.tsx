import { useCabaneDom } from "@cabane/engine";
import type { ThreeEvent } from "@react-three/fiber";
import {
  resolveItemTransform,
  type DeviceModelRegistry,
  type FloorSpec,
  type FurnishingModelRegistry,
  type ItemPlacement,
  type SceneItemSpec,
} from "@cabane/engine";
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BoxGeometry, DoubleSide, Plane, Vector3 } from "three";
import { noPlanRaycast, PlanOverlayMaterial } from "../construct/PlanDrawing";
import { placementForWorldDrag, selectionBoxGeometry } from "./editor-state";
import { missingModelEditorDescriptor } from "./missing-model";
import { expandItemSelection, itemSelectionUnits, toggleItemSelection } from "./item-groups";
import { furnishingSelectionTarget } from "./selection-target";
import { SelectionBounds } from "./SelectionBounds";

interface DragSession {
  items: readonly SceneItemSpec[];
  origin: Vector3;
  active: boolean;
  id: string;
  elevation: number;
  offsetX: number;
  offsetZ: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  target: PointerCaptureTarget | null;
}

const DRAG_ACTIVATION_DISTANCE_PX = 8;

export interface FurnishingEditLayerProps {
  items: readonly SceneItemSpec[];
  floor: FloorSpec;
  furnishingModels: FurnishingModelRegistry;
  deviceModels: DeviceModelRegistry;
  selectedId: string | null;
  selectedIds?: readonly string[];
  onSelectMany?: (ids: string[]) => void;
  selectionOnly?: boolean;
  onSelect: (id: string) => void;
  onMovePlacements?: (placements: Readonly<Record<string, ItemPlacement>>) => void;
  onMovePlacement: (id: string, placement: ItemPlacement) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: (id: string) => void;
  onDragCancel?: (id: string) => void;
  onDraggingChange?: (dragging: boolean) => void;
}

const boxSelectionModifier = (event: ThreeEvent<MouseEvent>) =>
  Boolean(
    (event.nativeEvent?.metaKey || event.nativeEvent?.ctrlKey) &&
    !event.nativeEvent?.shiftKey &&
    !event.nativeEvent?.altKey,
  );

const cameraModifier = (event: ThreeEvent<MouseEvent>) => Boolean(event.nativeEvent?.shiftKey);

const modifierIsPressed = (event: ThreeEvent<PointerEvent>) => event.nativeEvent.altKey;

type PointerCaptureTarget = EventTarget & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
};

const pointerCaptureTarget = (event: ThreeEvent<PointerEvent>) =>
  event.target as PointerCaptureTarget | null;

export function FurnishingEditLayer({
  items,
  floor,
  furnishingModels,
  deviceModels,
  selectedId,
  selectedIds = selectedId ? [selectedId] : [],
  onSelectMany,
  selectionOnly = false,
  onSelect,
  onMovePlacement,
  onMovePlacements,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onDraggingChange,
}: FurnishingEditLayerProps) {
  const dom = useCabaneDom();
  const [rectangle, setRectangle] = useState<{ from: Vector3; to: Vector3 } | null>(null);
  const marquee = useRef<{
    from: Vector3;
    to: Vector3;
    active: boolean;
    startClientX: number;
    startClientY: number;
    pointerId: number;
    target: PointerCaptureTarget | null;
  } | null>(null);
  const drag = useRef<DragSession | null>(null);
  const backgroundPointerDown = useRef(false);
  const dragPlane = useRef(new Plane(new Vector3(0, 1, 0), 0));
  const scratch = useRef(new Vector3());
  const callbacks = useRef({ onDragEnd, onDragCancel, onDraggingChange });
  useLayoutEffect(() => {
    callbacks.current = { onDragEnd, onDragCancel, onDraggingChange };
  });
  const unitBox = useMemo(() => new BoxGeometry(1, 1, 1), []);
  useEffect(() => () => unitBox.dispose(), [unitBox]);

  const pointOnElevationPlane = (event: ThreeEvent<PointerEvent>, elevation: number) => {
    dragPlane.current.constant = -elevation;
    return event.ray.intersectPlane(dragPlane.current, scratch.current);
  };

  const endDrag = (cancel: boolean) => {
    if (marquee.current) {
      const current = marquee.current;
      marquee.current = null;
      setRectangle(null);
      if (!cancel && current.active)
        onSelectMany?.(
          items
            .filter((item) => {
              const [x, , z] = resolveItemTransform(item.placement, floor).position;
              return (
                x >= Math.min(current.from.x, current.to.x) &&
                x <= Math.max(current.from.x, current.to.x) &&
                z >= Math.min(current.from.z, current.to.z) &&
                z <= Math.max(current.from.z, current.to.z)
              );
            })
            .map((item) => item.id),
        );
      callbacks.current.onDraggingChange?.(false);
      current.target?.releasePointerCapture?.(current.pointerId);
    }
    if (!drag.current) return;
    const { active, id, pointerId, target } = drag.current;
    drag.current = null;
    if (active) {
      callbacks.current.onDraggingChange?.(false);
      if (cancel) callbacks.current.onDragCancel?.(id);
      else callbacks.current.onDragEnd?.(id);
    }
    target?.releasePointerCapture?.(pointerId);
  };
  const finishDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return;
    event.stopPropagation();
    endDrag(false);
  };
  const cancelDrag = useEffectEvent(() => endDrag(true));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (!drag.current && !marquee.current)) return;
      event.preventDefault();
      event.stopPropagation();
      cancelDrag();
    };
    const blur = () => cancelDrag();
    dom.events.addEventListener("keydown", cancel, true);
    window.addEventListener("blur", blur);
    return () => {
      dom.events.removeEventListener("keydown", cancel, true);
      window.removeEventListener("blur", blur);
      cancelDrag();
    };
  }, [dom]);

  return (
    <group name="furnishing-edit-layer">
      {!selectionOnly && onSelectMany && (
        <mesh
          name="arrange-marquee-surface"
          onClick={(event) => {
            event.stopPropagation();
            const startedOnBackground = backgroundPointerDown.current;
            backgroundPointerDown.current = false;
            if (startedOnBackground && !boxSelectionModifier(event) && !cameraModifier(event))
              onSelectMany([]);
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(event) => {
            backgroundPointerDown.current =
              event.button === 0 && !boxSelectionModifier(event) && !cameraModifier(event);
            if (event.button !== 0 || !boxSelectionModifier(event)) return;
            const hit = pointOnElevationPlane(event, 0);
            if (!hit) return;
            event.stopPropagation();
            marquee.current = {
              from: hit.clone(),
              to: hit.clone(),
              active: false,
              startClientX: event.nativeEvent.clientX,
              startClientY: event.nativeEvent.clientY,
              pointerId: event.pointerId,
              target: pointerCaptureTarget(event),
            };
            pointerCaptureTarget(event)?.setPointerCapture?.(event.pointerId);
            onDraggingChange?.(true);
          }}
          onPointerMove={(event) => {
            const current = marquee.current;
            if (!current || current.pointerId !== event.pointerId) return;
            event.stopPropagation();
            const hit = pointOnElevationPlane(event, 0);
            if (hit) {
              current.to = hit.clone();
              current.active ||=
                Math.hypot(
                  event.nativeEvent.clientX - current.startClientX,
                  event.nativeEvent.clientY - current.startClientY,
                ) >= DRAG_ACTIVATION_DISTANCE_PX;
              if (current.active) setRectangle({ ...current });
            }
          }}
          onPointerUp={(event) => {
            if (marquee.current?.pointerId === event.pointerId) {
              event.stopPropagation();
              endDrag(false);
            }
          }}
          onPointerCancel={() => endDrag(true)}
          onLostPointerCapture={() => endDrag(true)}
        >
          <planeGeometry args={[10000, 10000]} />
          <PlanOverlayMaterial
            visible={false}
            transparent
            opacity={0}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}
      {rectangle && (
        <mesh
          name="arrange-marquee-preview"
          raycast={noPlanRaycast}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[
            (rectangle.from.x + rectangle.to.x) / 2,
            0.02,
            (rectangle.from.z + rectangle.to.z) / 2,
          ]}
          renderOrder={40}
        >
          <planeGeometry
            args={[
              Math.abs(rectangle.to.x - rectangle.from.x),
              Math.abs(rectangle.to.z - rectangle.from.z),
            ]}
          />
          <PlanOverlayMaterial
            color="#6b896c"
            transparent
            opacity={0.25}
            depthTest={false}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}
      {items.map((item) => {
        const registeredDefinition =
          item.kind === "device" ? deviceModels[item.modelId] : furnishingModels[item.modelId];
        const definition = registeredDefinition ?? missingModelEditorDescriptor(item);
        const transform = resolveItemTransform(item.placement, floor);
        const box = selectionBoxGeometry(item, definition, 0.035);
        const selected = selectedIds.includes(item.id);
        return (
          <group
            key={item.id}
            name={`furnishing-edit-target-${item.id}`}
            position={transform.position}
            rotation={[0, transform.rotationYRadians, 0]}
          >
            <mesh
              position={box.center}
              scale={box.size}
              geometry={unitBox}
              onClick={(event) => {
                event.stopPropagation();
                if (boxSelectionModifier(event) && onSelectMany) {
                  onSelectMany(toggleItemSelection(items, selectedIds, item.id));
                  return;
                }
                if (!cameraModifier(event) && !boxSelectionModifier(event) && !selected)
                  onSelect(item.id);
              }}
              onPointerDown={(event) => {
                backgroundPointerDown.current = false;
                if (
                  event.button !== 0 ||
                  cameraModifier(event) ||
                  boxSelectionModifier(event) ||
                  drag.current ||
                  selectionOnly
                )
                  return;
                event.stopPropagation();
                // Select taps on click, after picking has finished. Selecting here
                // opens Properties and can move the item out from under the pointer.
                const hit = pointOnElevationPlane(event, transform.position[1]);
                if (!hit) return;
                const dragIds = new Set(
                  selected ? selectedIds : expandItemSelection(items, [item.id]),
                );
                drag.current = {
                  items: items.filter((candidate) => dragIds.has(candidate.id)),
                  origin: new Vector3(...transform.position),
                  active: false,
                  id: item.id,
                  elevation: transform.position[1],
                  offsetX: transform.position[0] - hit.x,
                  offsetZ: transform.position[2] - hit.z,
                  pointerId: event.pointerId,
                  startClientX: event.nativeEvent.clientX,
                  startClientY: event.nativeEvent.clientY,
                  target: pointerCaptureTarget(event),
                };
                pointerCaptureTarget(event)?.setPointerCapture?.(event.pointerId);
              }}
              onPointerMove={(event) => {
                const session = drag.current;
                if (!session || session.id !== item.id || session.pointerId !== event.pointerId)
                  return;
                event.stopPropagation();
                if (!session.active) {
                  const movement = Math.hypot(
                    event.nativeEvent.clientX - session.startClientX,
                    event.nativeEvent.clientY - session.startClientY,
                  );
                  if (movement < DRAG_ACTIVATION_DISTANCE_PX) return;
                  session.active = true;
                  onDraggingChange?.(true);
                  if (!selected) onSelect(item.id);
                  onDragStart?.(item.id);
                }
                const hit = pointOnElevationPlane(event, session.elevation);
                if (!hit) return;
                if (session.items.length > 1 || session.items[0]?.group) {
                  const dx = hit.x + session.offsetX - session.origin.x;
                  const dz = hit.z + session.offsetZ - session.origin.z;
                  const x = modifierIsPressed(event) ? dx : Math.round(dx * 10) / 10;
                  const z = modifierIsPressed(event) ? dz : Math.round(dz * 10) / 10;
                  const placements: Record<string, ItemPlacement> = {};
                  for (const member of session.items) {
                    const model =
                      (member.kind === "device"
                        ? deviceModels[member.modelId]
                        : furnishingModels[member.modelId]) ?? missingModelEditorDescriptor(member);
                    const [mx, , mz] = resolveItemTransform(member.placement, floor).position;
                    placements[member.id] = placementForWorldDrag({
                      world: { x: mx + x, z: mz + z },
                      item: member,
                      definition: model,
                      floor,
                      raw: true,
                    });
                  }
                  onMovePlacements?.(placements);
                  return;
                }
                onMovePlacement(
                  item.id,
                  placementForWorldDrag({
                    world: {
                      x: hit.x + session.offsetX,
                      z: hit.z + session.offsetZ,
                    },
                    item,
                    definition,
                    floor,
                    raw: modifierIsPressed(event),
                  }),
                );
              }}
              onPointerUp={finishDrag}
              onPointerCancel={() => endDrag(true)}
              onLostPointerCapture={() => endDrag(true)}
              renderOrder={20}
            >
              <PlanOverlayMaterial
                color={selected ? "#6b896c" : "#ffffff"}
                transparent
                visible={selected}
                opacity={0.12}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
      {itemSelectionUnits(items.filter((item) => selectedIds.includes(item.id))).map((unit) => {
        const target = furnishingSelectionTarget(
          unit.items,
          floor,
          { furnishingModels, deviceModels },
          unit.name ?? "Selected item",
        );
        return (
          <group key={unit.id} position={target.position} rotation={[0, target.rotation, 0]}>
            <SelectionBounds {...target.box} />
          </group>
        );
      })}
    </group>
  );
}
