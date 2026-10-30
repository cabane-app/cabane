import { showEntityStateInScene } from "./entity-slot-visibility";
import { useSceneOverlay } from "./room-status/SceneOverlayLayout";
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
}: {
  item: SceneItemSpec;
  floor: FloorSpec;
  states: Readonly<Record<string, EntityStateSnapshot>>;
}) {
  const readings = itemEntityReadings(item.entitySlots ?? [], states);
  const { anchorRef, labelRef, visible } = useSceneOverlay({
    id: `item:${item.id}`,
    labelWidth: 220,
    labelHeight: 16 + readings.length * 21,
    priority: 1,
    enabled: readings.length > 0,
  });
  if (!readings.length) return null;
  const { position } = resolveItemTransform(item.placement, floor);
  const height = item.placement.kind === "ceiling" ? 0 : item.size[1];
  return (
    <group ref={anchorRef} position={[position[0], position[1] + height + 0.15, position[2]]}>
      <Html center zIndexRange={[7, 0]} pointerEvents="none">
        <div ref={labelRef} className="item-entity-readings" hidden={!visible}>
          {readings.map((reading) => (
            <div key={reading.id}>
              <span>{reading.label}</span>
              <strong>{reading.value}</strong>
            </div>
          ))}
        </div>
      </Html>
    </group>
  );
}
