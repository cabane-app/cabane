import { omitUndefinedProperties } from "./defined-properties";
import { OpeningThreshold } from "./architecture-scene/OpeningThreshold";
import { memo, useRef } from "react";
import type {
  ArchitectureModelComponent,
  ArchitectureModelProps,
  OpeningSpec,
  ExtensionInteractionTarget,
} from "./types";

/** Keep procedural opening models mounted across scene-item/profile updates. */
function SceneOpening<Opening extends OpeningSpec>({
  model: Model,
  onInteract,
  walkMode,
  ...props
}: ArchitectureModelProps<Opening> & {
  model: ArchitectureModelComponent<Opening>;
  onInteract?: ((target: ExtensionInteractionTarget) => void) | undefined;
  walkMode?: boolean;
}) {
  const press = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const slot = props.opening.coverSlot;
  const target =
    slot && onInteract
      ? { id: props.opening.id, slotId: slot.id, label: props.opening.name || "Garage door" }
      : undefined;
  return (
    <group
      {...omitUndefinedProperties({
        userData: target ? { walkDeviceInteraction: target } : undefined,
      })}
      {...omitUndefinedProperties({
        onPointerDown:
          !target || walkMode
            ? undefined
            : (event: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                press.current = {
                  pointerId: event.pointerId,
                  x: event.nativeEvent.clientX,
                  y: event.nativeEvent.clientY,
                };
              },
      })}
      {...omitUndefinedProperties({
        onPointerUp:
          !target || walkMode
            ? undefined
            : (event: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                const start = press.current;
                press.current = null;
                if (
                  start?.pointerId === event.pointerId &&
                  Math.hypot(
                    event.nativeEvent.clientX - start.x,
                    event.nativeEvent.clientY - start.y,
                  ) <= 6
                )
                  onInteract?.(target);
              },
      })}
      onPointerCancel={() => {
        press.current = null;
      }}
    >
      <OpeningThreshold wall={props.wall} opening={props.opening} floor={props.floor} />
      <Model {...props} />
    </group>
  );
}

export const SceneOpeningRenderer = memo(
  SceneOpening,
  (before, after) =>
    before.model === after.model &&
    before.wall === after.wall &&
    before.floor === after.floor &&
    before.position === after.position &&
    before.reducedMotion === after.reducedMotion &&
    before.onInteract === after.onInteract &&
    before.walkMode === after.walkMode &&
    (before.opening === after.opening ||
      JSON.stringify(before.opening) === JSON.stringify(after.opening)),
) as typeof SceneOpening;
