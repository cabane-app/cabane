import { isOutdoorPlatformRoom, outdoorPlatformRoomId } from "../outdoor-platforms/platform-rooms";
import { useTerrainSurface } from "../terrain/TerrainSurface";
import { conformToTerrain } from "../terrain/terrain-geometry";
import { omitUndefinedProperties } from "../defined-properties";
import { useCabaneDom } from "./../CabaneDom";
import { useHoveredRoom, useRoomHoverTarget, useRoomHoverEnabled } from "../room-status/RoomHover";
import { useStairSurfaceApertures } from "../stairs/surface-apertures";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { DoubleSide, type Mesh } from "three";
import { ToonMaterial } from "../rendering";
import { RoomFloorMaterial } from "../room-navigation/RoomFloorMaterial";
import { roomSurfaceEmphasis } from "../room-navigation/room-surface-emphasis";
import { POOL_GROUND_Y } from "../pools/pool-footprint";
import type { FloorFinishSpec, FloorSpec, Polygon } from "../types";
import { createFloorFinishGeometry, isFloorZoneOutline } from "./finish-geometry";
import {
  floorFinishPreset,
  floorFinishRepresentativeColor,
  resolveRoomFloorFinish,
  type FloorPatternVariant,
} from "./presets";
import { createFloorFinishTextureSet, type FloorFinishTextureSet } from "./textures";

interface FinishSurfaceProps {
  floor: FloorSpec;
  polygon: Polygon;
  finish: FloorFinishSpec;
  variant: FloorPatternVariant;
  textureSet: FloorFinishTextureSet;
  layer: number;
  name: string;
  roomId?: string | undefined;
  interactionColor?: string;
  selected?: boolean;
  reducedMotion?: boolean;
  onSelect?: (() => void) | undefined;
  elevation?: number;
  cutPools?: boolean;
  emphasis?: number;
}

function FinishSurface({
  floor,
  polygon,
  finish,
  variant,
  textureSet,
  layer,
  name,
  roomId,
  interactionColor,
  selected = false,
  reducedMotion = false,
  onSelect,
  elevation: requestedElevation,
  cutPools = false,
  emphasis = 1,
}: FinishSurfaceProps) {
  const dom = useCabaneDom();
  const repeatMeters = finish.kind === "preset" ? floorFinishPreset(finish.preset).repeatMeters : 1;
  const terrain = useTerrainSurface();
  const groundTerrain =
    cutPools && variant === "scene" && floor.id === terrain?.floorId ? terrain : null;
  const apertures = useStairSurfaceApertures("floor");
  const terrainApertures = useStairSurfaceApertures("terrain");
  const geometry = useMemo(
    () =>
      conformToTerrain(
        createFloorFinishGeometry(
          polygon,
          floor.coordinates,
          repeatMeters,
          [...apertures, ...(cutPools ? terrainApertures : []), ...(groundTerrain?.cutouts ?? [])],
          cutPools ? floor : undefined,
        ),
        groundTerrain,
      ),
    [cutPools, floor, polygon, repeatMeters, apertures, terrainApertures, groundTerrain],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const texture = finish.kind === "preset" ? textureSet.get(finish.preset, finish.color) : null;
  const color = floorFinishRepresentativeColor(finish);
  const press = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const interactionRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const hoveredRoom = useHoveredRoom();
  const sharedHoverEnabled = useRoomHoverEnabled();
  const setRoomHover = useRoomHoverTarget();
  const [pressed, setPressed] = useState(false);
  const interactionOpacity = selected
    ? 0.055
    : pressed
      ? 0.28
      : hovered || (roomId !== undefined && hoveredRoom === roomId)
        ? 0.18
        : 0;
  const opacityRef = useRef(selected ? 0.055 : 0);
  const { invalidate } = useThree();

  useEffect(() => invalidate(), [interactionOpacity, invalidate]);
  useEffect(() => {
    if ((roomId && sharedHoverEnabled) || !hovered || !onSelect || typeof document === "undefined")
      return;
    const previous = dom.container.style.cursor;
    dom.container.style.cursor = "pointer";
    return () => {
      dom.container.style.cursor = previous;
    };
  }, [hovered, onSelect, roomId, sharedHoverEnabled, dom]);

  useFrame((_state, delta) => {
    const interaction = interactionRef.current;
    const material = interaction?.material;
    if (!material || Array.isArray(material)) return;
    const next = reducedMotion
      ? interactionOpacity
      : opacityRef.current +
        (interactionOpacity - opacityRef.current) * (1 - Math.exp(-16 * delta));
    const resolved = Math.abs(next - interactionOpacity) < 0.002 ? interactionOpacity : next;
    if (Math.abs(resolved - opacityRef.current) > 0.0005) {
      opacityRef.current = resolved;
      material.opacity = resolved;
    }
    interaction.visible = resolved > 0.001;
    if (Math.abs(resolved - interactionOpacity) >= 0.002) invalidate();
  });

  const clearPress = () => {
    press.current = null;
    setPressed(false);
  };

  const pointerProps = onSelect
    ? {
        onPointerOver: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setHovered(true);
          if (roomId) setRoomHover(roomId);
        },
        onPointerOut: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setHovered(false);
          setRoomHover(null);
          clearPress();
        },
        onPointerDown: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setPressed(true);
          press.current = {
            pointerId: event.pointerId,
            x: event.nativeEvent.clientX,
            y: event.nativeEvent.clientY,
          };
        },
        onPointerMove: (event: ThreeEvent<PointerEvent>) => {
          const current = press.current;
          if (
            current &&
            Math.hypot(
              event.nativeEvent.clientX - current.x,
              event.nativeEvent.clientY - current.y,
            ) > 10
          )
            clearPress();
        },
        onPointerUp: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          const current = press.current;
          clearPress();
          if (current?.pointerId === event.pointerId) onSelect();
        },
        onPointerCancel: () => {
          clearPress();
          setHovered(false);
          setRoomHover(null);
        },
      }
    : {};
  // Texture presence changes shader defines; recreate when switching solid/pattern.
  const material =
    variant === "plan" ? (
      <ToonMaterial
        key={texture ? "pattern" : "solid"}
        color="#000000"
        emissive={texture ? "#ffffff" : color}
        {...omitUndefinedProperties({ emissiveMap: texture ?? undefined })}
        emissiveIntensity={1}
        toneMapped={false}
        side={DoubleSide}
        polygonOffset={layer > 0}
        polygonOffsetFactor={-layer}
        polygonOffsetUnits={-layer}
      />
    ) : (
      <RoomFloorMaterial
        key={texture ? "pattern" : "solid"}
        color={texture ? "#ffffff" : color}
        emphasis={emphasis}
        reducedMotion={reducedMotion}
        {...omitUndefinedProperties({ map: texture ?? undefined })}
        side={DoubleSide}
        polygonOffset={layer > 0}
        polygonOffsetFactor={-layer}
        polygonOffsetUnits={-layer}
      />
    );
  const elevation = requestedElevation ?? (variant === "scene" ? 0.012 : 0.001);
  return (
    <group>
      <mesh
        name={name}
        geometry={geometry}
        position={[0, elevation, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow={variant === "scene"}
        renderOrder={layer}
        {...pointerProps}
      >
        {material}
      </mesh>
      {variant === "scene" && interactionColor && (
        <mesh
          ref={interactionRef}
          name={`${name}-interaction`}
          geometry={geometry}
          position={[0, elevation + 0.003, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => undefined}
          renderOrder={100 + layer}
          visible={reducedMotion ? interactionOpacity > 0 : opacityRef.current > 0.001}
        >
          <ToonMaterial
            color={interactionColor}
            transparent
            opacity={interactionOpacity}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

export const FloorFinishSurfaces = memo(function FloorFinishSurfaces({
  floor,
  variant,
  selectedRoomId = null,
  reducedMotion = false,
  onSelectRoom,
}: {
  floor: FloorSpec;
  variant: FloorPatternVariant;
  selectedRoomId?: string | null;
  reducedMotion?: boolean;
  onSelectRoom?: ((id: string) => void) | undefined;
}) {
  const textureSet = useMemo(() => createFloorFinishTextureSet(variant), [variant]);
  useEffect(() => () => textureSet.dispose(), [textureSet]);
  return (
    <group name={`floor-finishes-${variant}`}>
      {(floor.groundZones ?? []).flatMap((zone, index) =>
        isFloorZoneOutline(zone.polygon)
          ? [
              <FinishSurface
                key={zone.id}
                floor={floor}
                polygon={zone.polygon}
                finish={zone.finish}
                variant={variant}
                textureSet={textureSet}
                layer={index + 1}
                elevation={variant === "scene" ? POOL_GROUND_Y + 0.006 : 0.001}
                cutPools
                name={`ground-zone-${zone.id}`}
              />,
            ]
          : [],
      )}
      {(floor.outdoorPlatforms ?? [])
        .filter((platform) => isFloorZoneOutline(platform.polygon))
        .map((platform) => (
          <FinishSurface
            key={platform.id}
            roomId={
              platform.useAsRoom && onSelectRoom ? outdoorPlatformRoomId(platform.id) : undefined
            }
            onSelect={
              platform.useAsRoom && onSelectRoom
                ? () => onSelectRoom(outdoorPlatformRoomId(platform.id))
                : undefined
            }
            selected={
              Boolean(platform.useAsRoom) && selectedRoomId === outdoorPlatformRoomId(platform.id)
            }
            {...(platform.useAsRoom ? { interactionColor: "#c9a477" } : {})}
            emphasis={roomSurfaceEmphasis(
              variant === "scene" && Boolean(onSelectRoom) && Boolean(platform.useAsRoom),
              selectedRoomId,
              outdoorPlatformRoomId(platform.id),
            )}
            reducedMotion={reducedMotion}
            floor={floor}
            polygon={platform.polygon}
            finish={platform.finish}
            variant={variant}
            textureSet={textureSet}
            layer={0}
            elevation={variant === "scene" ? 0.002 : 0.001}
            name={`platform-finish-${platform.id}`}
          />
        ))}
      {floor.rooms.flatMap((room) => {
        if (isOutdoorPlatformRoom(floor, room.id) || (room.isSolid && variant === "scene"))
          return [];
        const onSelect = onSelectRoom ? () => onSelectRoom(room.id) : undefined;
        const common = {
          roomId: onSelectRoom ? room.id : undefined,
          floor,
          variant,
          textureSet,
          interactionColor: room.accent,
          selected: selectedRoomId === room.id,
          emphasis: roomSurfaceEmphasis(
            variant === "scene" && Boolean(onSelectRoom),
            selectedRoomId,
            room.id,
          ),
          reducedMotion,
          onSelect,
        };
        return [
          <FinishSurface
            key={room.id}
            {...common}
            polygon={room.polygon}
            finish={
              room.isSolid ? { kind: "solid", color: "#b8b3aa" } : resolveRoomFloorFinish(room)
            }
            layer={0}
            name={`room-${room.id}`}
          />,
          ...(room.isSolid ? [] : (room.floorZones ?? [])).flatMap((zone, index) =>
            isFloorZoneOutline(zone.polygon)
              ? [
                  <FinishSurface
                    key={zone.id}
                    {...common}
                    polygon={zone.polygon}
                    finish={zone.finish}
                    layer={index + 1}
                    name={`floor-zone-${zone.id}`}
                  />,
                ]
              : [],
          ),
        ];
      })}
    </group>
  );
});
