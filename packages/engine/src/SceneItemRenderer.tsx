import { ModelLightingSurface } from "./model-lighting/ModelLightingSurface";
import { lightingSlotForItem } from "./model-lighting/settings";
import { useVacuumRoom } from "./vacuum-cleaning-location";
import { useHomeAssistantRuntime } from "./HomeAssistantRuntimeContext";
import { planPointToWorld } from "./geometry";
import { omitUndefinedProperties } from "./defined-properties";
import { useCabaneDom } from "./CabaneDom";
import { resolveModelVariant } from "./model-variants";
import { memo, useContext, useEffect, useState } from "react";
import { orbitLightEntity } from "./orbit-light-control";
import { useOrbitDevicePress } from "./useOrbitDevicePress";
import { SceneNightContext, sceneLightState } from "./scene-light-state";
import { deviceVisualStateForSnapshot } from "./devices";
import {
  deviceSlotForItem,
  resolveItemTransform,
  type ResolvedItemTransform,
  type SceneItemSpec,
} from "./home-project";
import { DeviceHoverContext, Outlines, ToonMaterial } from "./rendering";
import type {
  DeviceLiveMedia,
  DeviceModelDefinition,
  DeviceModelRegistry,
  EntityId,
  EntityStateSnapshot,
  ExtensionInteractionTarget,
  FloorSpec,
  FurnishingModelRegistry,
  FurnishingModelDefinition,
  SceneModelProps,
  ResolvedDeviceBinding,
} from "./types";

const deviceSceneItemScaleForSize = (
  size: readonly [number, number, number],
  definition: DeviceModelDefinition,
): readonly [number, number, number] | null => {
  if (size.some((dimension) => !Number.isFinite(dimension) || dimension <= 0)) return null;
  const sizeRatios = size.map((dimension, axis) => dimension / definition.defaultSize[axis]);
  const same = (left: number, right: number) => Math.abs(left - right) <= 1e-6;
  const policy = definition.resizePolicy;
  if (
    policy.kind === "fixed" &&
    size.some((dimension, axis) => !same(dimension, definition.defaultSize[axis]))
  )
    return null;
  if (policy.kind === "uniform" && sizeRatios.some((ratio) => !same(ratio, sizeRatios[0])))
    return null;
  if (policy.kind === "planar" && !same(size[1], definition.defaultSize[1])) return null;
  if (policy.kind === "axes") {
    const allowed = new Set(policy.axes);
    const axisNames = ["width", "height", "depth"] as const;
    if (
      size.some(
        (dimension, axis) =>
          !allowed.has(axisNames[axis]) && !same(dimension, definition.defaultSize[axis]),
      )
    )
      return null;
  }
  if (policy.kind === "custom") {
    const normalized = policy.normalize(definition.defaultSize, size);
    if (normalized.some((dimension, axis) => !same(dimension, size[axis]))) return null;
  }
  const extents = definition.bounds.max.map(
    (maximum, axis) => maximum - definition.bounds.min[axis],
  );
  if (extents.some((extent) => !Number.isFinite(extent) || extent <= 0)) return null;
  const scale = size.map((dimension, axis) => dimension / extents[axis]);
  return scale.every((value) => Number.isFinite(value) && value > 0)
    ? (scale as [number, number, number])
    : null;
};

function DeviceSceneItem({
  item,
  transform,
  definition,
  resolvedDevice,
  reducedMotion,
  walkMode,
  onInteract,
  liveMediaByEntityId,
  groupName,
  floor,
  lightingStates,
}: {
  item: Extract<SceneItemSpec, { kind: "device" }>;
  transform: ResolvedItemTransform;
  definition: DeviceModelDefinition;
  resolvedDevice: ResolvedDeviceBinding;
  reducedMotion: boolean;
  walkMode: boolean;
  onInteract: (target: ExtensionInteractionTarget) => void;
  liveMediaByEntityId: Readonly<Partial<Record<EntityId, DeviceLiveMedia>>>;
  groupName: string;
  floor: FloorSpec;
  lightingStates: Readonly<Record<string, EntityStateSnapshot>>;
}) {
  const dom = useCabaneDom();
  const scale = deviceSceneItemScaleForSize(item.size, definition);
  const [hovered, setHovered] = useState(false);
  const nightLighting = useContext(SceneNightContext);

  useEffect(() => {
    if (!hovered || typeof document === "undefined") return;
    const previousCursor = dom.container.style.cursor;
    dom.container.style.cursor = "pointer";
    return () => {
      dom.container.style.cursor = previousCursor;
    };
  }, [hovered, dom]);

  const renderable = scale !== null;
  useEffect(() => {
    if (!walkMode && renderable) return;
    setHovered(false);
  }, [renderable, walkMode]);

  const Component = definition.component;
  const binding = resolvedDevice.slot;
  const primarySlot = binding.entitySlots.find((slot) => slot.deviceRole === "primary");
  const primary = resolvedDevice.entities.find((entity) => entity.slotId === primarySlot?.id);
  const state = sceneLightState(
    definition.lightingDisabled && primarySlot?.compatibleDomains.includes("light")
      ? "always-off"
      : item.lightState,
    primary?.state,
    nightLighting,
  );
  const lightingSlot = lightingSlotForItem(item);
  const lightingState = sceneLightState(
    item.lightState,
    lightingSlot
      ? (lightingStates[lightingSlot.id] ??
          (lightingSlot.id === primarySlot?.id ? primary?.state : undefined))
      : undefined,
    nightLighting,
  );
  const visualState = deviceVisualStateForSnapshot(state);
  const runtime = useHomeAssistantRuntime();
  const cleaningRoom = useVacuumRoom(
    runtime.callService,
    primary?.entityId,
    state?.state === "cleaning",
  );
  const room = floor.rooms.find((candidate) => candidate.id === cleaningRoom);
  const cleaning =
    item.modelId === "robot-vacuum" &&
    state?.available &&
    !state.stale &&
    state.state === "cleaning";
  const points =
    cleaning && room ? room.polygon.map((point) => planPointToWorld(point, floor.coordinates)) : [];
  const position = points.length
    ? ([
        points.reduce((sum, p) => sum + p[0], 0) / points.length,
        transform.position[1],
        points.reduce((sum, p) => sum + p[1], 0) / points.length,
      ] as [number, number, number])
    : transform.position;
  const walkInteractionTarget = {
    id: item.id,
    label: primarySlot?.presentation.label ?? item.id,
    ...(primarySlot ? { slotId: primarySlot.id } : {}),
  } satisfies ExtensionInteractionTarget;
  const interactionTarget = {
    ...walkInteractionTarget,
    ...(definition.interaction.target === "camera-viewer" &&
    (!primary || primary.entityId.startsWith("camera."))
      ? { intent: definition.interaction.target }
      : {}),
  } satisfies ExtensionInteractionTarget;
  const pressHandlers = useOrbitDevicePress({
    enabled: !walkMode && renderable,
    target: interactionTarget,
    light: orbitLightEntity(resolvedDevice),
    tapTolerancePixels: definition.interaction.tapTolerancePixels,
    onInteract,
  });
  if (scale === null) return null;

  return (
    <group
      name={groupName}
      position={position}
      rotation={[0, transform.rotationYRadians, 0]}
      scale={scale}
      userData={{
        walkCollider: item.modelId.startsWith("custom:") && item.placement.kind === "absolute",
        deviceBindingId: item.id,
        deviceModel: item.modelId,
        visualState,
        walkDeviceInteraction: walkInteractionTarget,
      }}
      {...omitUndefinedProperties({
        onPointerOver: walkMode
          ? undefined
          : (event: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
              event.stopPropagation();
              setHovered(true);
            },
      })}
      {...omitUndefinedProperties({
        onPointerOut: walkMode
          ? undefined
          : (event: import("@react-three/fiber").ThreeEvent<PointerEvent>) => {
              event.stopPropagation();
              setHovered(false);
            },
      })}
      {...(!walkMode ? pressHandlers : {})}
    >
      <ModelLightingSurface
        revision={`${item.variant ?? ""}|${item.color ?? ""}|${item.size.join(",")}`}
        light={definition.lighting}
        state={lightingState}
        imported={item.modelId.startsWith("custom:")}
      >
        <DeviceHoverContext.Provider value={hovered}>
          <Component
            variant={resolveModelVariant(definition, item.variant).id}
            {...omitUndefinedProperties({ color: item.color })}
            slot={binding}
            {...omitUndefinedProperties({ state: state })}
            {...omitUndefinedProperties({
              liveMedia: primary ? liveMediaByEntityId[primary.entityId] : undefined,
            })}
            visualState={visualState}
            reducedMotion={reducedMotion}
            walkMode={walkMode}
            onInteract={onInteract}
          />
        </DeviceHoverContext.Provider>
      </ModelLightingSurface>
    </group>
  );
}

const FurnishingContent = memo(function FurnishingContent({
  component: Component,
  ...props
}: SceneModelProps & {
  component: FurnishingModelDefinition["component"];
}) {
  return <Component {...props} />;
});

function MissingSceneItemFallback({ item }: { item: SceneItemSpec }) {
  const y =
    item.placement.kind === "ceiling"
      ? -item.size[1] / 2
      : item.placement.kind === "wall"
        ? 0
        : item.size[1] / 2;
  return (
    <mesh
      name={`missing-model-${item.id}`}
      position={[0, y, 0]}
      userData={{ missingModelId: item.modelId }}
    >
      <boxGeometry args={item.size} />
      <ToonMaterial color="#d9a36a" transparent opacity={0.72} />
      <Outlines color="#6f4b2f" thickness={0.006} screenspace={false} />
    </mesh>
  );
}

export const SceneItemRenderer = memo(function SceneItemRenderer({
  item,
  floor,
  furnishingModels,
  deviceModels,
  resolvedDevice,
  entityStatesBySlotId,
  reducedMotion,
  walkMode,
  onInteract,
  liveMediaByEntityId,
}: {
  item: SceneItemSpec;
  floor: FloorSpec;
  furnishingModels: FurnishingModelRegistry;
  deviceModels: DeviceModelRegistry;
  resolvedDevice?: ResolvedDeviceBinding;
  entityStatesBySlotId: Readonly<Record<string, EntityStateSnapshot>>;
  reducedMotion: boolean;
  walkMode: boolean;
  onInteract: (target: ExtensionInteractionTarget) => void;
  liveMediaByEntityId: Readonly<Partial<Record<EntityId, DeviceLiveMedia>>>;
  outlineColor?: string;
}) {
  const nightLighting = useContext(SceneNightContext);
  const lightSlot = lightingSlotForItem(item);
  const lightState = sceneLightState(
    item.lightState,
    lightSlot ? entityStatesBySlotId[lightSlot.id] : undefined,
    nightLighting,
  );
  const transform = resolveItemTransform(item.placement, floor);
  if (item.kind === "furnishing") {
    const definition = Object.hasOwn(furnishingModels, item.modelId)
      ? furnishingModels[item.modelId]
      : undefined;
    return (
      <group
        name={`scene-item-${item.id}`}
        userData={{
          walkCollider: item.modelId.startsWith("custom:") && item.placement.kind === "absolute",
        }}
        position={transform.position}
        rotation={[0, transform.rotationYRadians, 0]}
      >
        {definition ? (
          <ModelLightingSurface
            revision={`${item.variant ?? ""}|${item.color ?? ""}|${item.size.join(",")}`}
            light={definition.lighting}
            state={lightState}
            imported={item.modelId.startsWith("custom:")}
          >
            <FurnishingContent
              component={definition.component}
              variant={resolveModelVariant(definition, item.variant).id}
              {...omitUndefinedProperties({ color: item.color })}
              size={item.size}
              entityStatesBySlotId={entityStatesBySlotId}
              reducedMotion={reducedMotion}
              walkMode={walkMode}
              onInteract={onInteract}
            />
          </ModelLightingSurface>
        ) : (
          <MissingSceneItemFallback item={item} />
        )}
      </group>
    );
  }

  const definition = Object.hasOwn(deviceModels, item.modelId)
    ? deviceModels[item.modelId]
    : undefined;
  if (!definition)
    return (
      <group
        name={`scene-item-${item.id}`}
        position={transform.position}
        rotation={[0, transform.rotationYRadians, 0]}
        userData={{ missingModelId: item.modelId }}
      >
        <MissingSceneItemFallback item={item} />
      </group>
    );
  // Roomless items (for example outdoor lights) have no room-scoped binding.
  // Their geometry still exists; absence of live state means disconnected.
  const binding = resolvedDevice ?? {
    slot: deviceSlotForItem(item, floor),
    entities: [],
    issues: [],
  };
  // The resolved slot is the runtime source of entity states, while the item
  // remains the source of placement and sizing. A mismatched ID is unsafe.
  if (binding.slot.id !== item.id || binding.slot.model !== item.modelId) return null;
  return (
    <DeviceSceneItem
      item={item}
      transform={transform}
      definition={definition}
      resolvedDevice={binding}
      reducedMotion={reducedMotion}
      walkMode={walkMode}
      onInteract={onInteract}
      liveMediaByEntityId={liveMediaByEntityId}
      floor={floor}
      lightingStates={entityStatesBySlotId}
      groupName={`scene-item-${item.id}`}
    />
  );
});

/** @internal Transitional adapter for manifests whose sceneItems are empty. */
export function LegacyDeviceItemRenderer({
  resolvedDevice,
  floor,
  definition,
  reducedMotion,
  walkMode,
  onInteract,
  liveMediaByEntityId,
}: {
  resolvedDevice: ResolvedDeviceBinding;
  floor: FloorSpec;
  definition: DeviceModelDefinition | undefined;
  reducedMotion: boolean;
  walkMode: boolean;
  onInteract: (target: ExtensionInteractionTarget) => void;
  liveMediaByEntityId: Readonly<Partial<Record<EntityId, DeviceLiveMedia>>>;
  outlineColor?: string;
}) {
  const scale = resolvedDevice.slot.placement.scale ?? 1;
  const item: Extract<SceneItemSpec, { kind: "device" }> = {
    id: resolvedDevice.slot.id,
    floorId: floor.id,
    kind: "device",
    modelId: resolvedDevice.slot.model,
    placement: {
      kind: "absolute",
      at: resolvedDevice.slot.placement.at,
      elevationMeters: resolvedDevice.slot.placement.elevationMeters,
      rotationYRadians: resolvedDevice.slot.placement.rotationYRadians ?? 0,
    },
    size: (definition?.defaultSize ?? [0.25, 0.25, 0.25]).map((dimension) => dimension * scale) as [
      number,
      number,
      number,
    ],
    entitySlots: resolvedDevice.slot.entitySlots,
  };
  if (!definition) {
    const transform = resolveItemTransform(item.placement, floor);
    return (
      <group
        name={`device-${item.id}`}
        position={transform.position}
        rotation={[0, transform.rotationYRadians, 0]}
      >
        <MissingSceneItemFallback item={item} />
      </group>
    );
  }
  return (
    <DeviceSceneItem
      item={item}
      transform={resolveItemTransform(item.placement, floor)}
      definition={definition}
      resolvedDevice={resolvedDevice}
      reducedMotion={reducedMotion}
      walkMode={walkMode}
      onInteract={onInteract}
      liveMediaByEntityId={liveMediaByEntityId}
      floor={floor}
      lightingStates={Object.fromEntries(
        resolvedDevice.entities
          .filter((entity) => entity.state)
          .map((entity) => [entity.slotId, entity.state!]),
      )}
      groupName={`device-${item.id}`}
    />
  );
}
