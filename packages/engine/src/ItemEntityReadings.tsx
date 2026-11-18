import { entityDisplayValue } from "./home-assistant-controls";
import { showEntityStateInScene } from "./entity-slot-visibility";
import { useSceneOverlay } from "./room-status/SceneOverlayLayout";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Vector3 } from "three";
import { Html } from "@react-three/drei";
import { resolveItemTransform, type SceneItemSpec } from "./home-project";
import type { EntityBindingSlotSpec, EntityStateSnapshot, FloorSpec } from "./types";

export const itemEntityReadings = (
  slots: readonly EntityBindingSlotSpec[],
  states: Readonly<Record<string, EntityStateSnapshot>>,
) =>
  slots
    .filter((slot) => showEntityStateInScene(slot, states[slot.id]))
    .map((slot) => {
      const state = states[slot.id];
      const unit = state?.attributes.unit_of_measurement;
      const value = !state
        ? "Not connected"
        : state.entityId.startsWith("event.")
          ? entityDisplayValue(state)
          : !state.available
            ? "Unavailable"
            : state.stale
              ? "Stale"
              : `${state.state}${typeof unit === "string" && unit ? ` ${unit}` : ""}`;
      return { id: slot.id, label: slot.presentation.label, value };
    });

export function ItemEntityReadings({
  item,
  floor,
  states,
  walkMode = false,
}: {
  walkMode?: boolean;
  item: SceneItemSpec;
  floor: FloorSpec;
  states: Readonly<Record<string, EntityStateSnapshot>>;
}) {
  const readings = itemEntityReadings(item.entitySlots ?? [], states);
  const { anchorRef, labelRef, visible } = useSceneOverlay({
    id: `item:${item.id}`,
    labelWidth: 220,
    labelHeight:
      16 +
      readings.reduce(
        (height, reading) => height + (states[reading.id]?.entityId.startsWith("event.") ? 53 : 21),
        0,
      ),
    priority: 1,
    enabled: readings.length > 0,
  });
  const faceRef = useRef<HTMLDivElement>(null);
  const cameraLocal = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    if (!walkMode || !anchorRef.current || !faceRef.current) return;
    anchorRef.current.worldToLocal(camera.getWorldPosition(cameraLocal));
    faceRef.current.hidden = cameraLocal.z <= 0;
  });
  if (!readings.length) return null;
  const { position, rotationYRadians } = resolveItemTransform(item.placement, floor);
  const ceiling = item.placement.kind === "ceiling";
  const height = walkMode
    ? (ceiling ? -0.5 : 0.5) * item.size[1]
    : (ceiling ? 0 : item.size[1]) + 0.15;
  const depth = walkMode ? item.size[2] / 2 + 0.06 : 0;
  return (
    <group
      ref={anchorRef}
      rotation={[0, rotationYRadians, 0]}
      position={[
        position[0] + depth * Math.sin(rotationYRadians),
        position[1] + height,
        position[2] + depth * Math.cos(rotationYRadians),
      ]}
    >
      <Html occlude={walkMode} center zIndexRange={[7, 0]} pointerEvents="none">
        <div ref={faceRef} key={String(walkMode)}>
          <div
            ref={labelRef}
            className="item-entity-readings"
            style={{ visibility: visible ? "visible" : "hidden" }}
          >
            {readings.map((reading) => (
              <div
                key={reading.id}
                className={
                  states[reading.id]?.entityId.startsWith("event.") ? "is-event" : undefined
                }
              >
                <span>{reading.label}</span>
                <strong>{reading.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </Html>
    </group>
  );
}
