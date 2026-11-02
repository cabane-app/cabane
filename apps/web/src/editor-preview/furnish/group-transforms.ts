import {
  pointInsidePolygon,
  resolveItemTransform,
  type FloorSpec,
  type ItemPlacement,
  type SceneItemSpec,
} from "@cabane/engine";

/** The anchor centroid stays fixed through rotation, including asymmetric models. */
export function itemGroupTransform(items: readonly SceneItemSpec[], floor: FloorSpec) {
  const transforms = items.map((item) => resolveItemTransform(item.placement, floor));
  return {
    position: [
      transforms.reduce((sum, transform) => sum + transform.position[0], 0) / items.length,
      Math.min(...transforms.map((transform) => transform.position[1])),
      transforms.reduce((sum, transform) => sum + transform.position[2], 0) / items.length,
    ] as const,
    rotationYRadians: transforms[0].rotationYRadians,
  };
}

export function transformItemGroup(
  items: readonly SceneItemSpec[],
  floor: FloorSpec,
  placement: Extract<ItemPlacement, { kind: "absolute" }>,
) {
  const before = itemGroupTransform(items, floor);
  const scale = floor.coordinates.metersPerPlanUnit;
  const target = [
    (placement.at[0] - floor.coordinates.origin[0]) * scale,
    placement.elevationMeters,
    (placement.at[1] - floor.coordinates.origin[1]) * scale,
  ];
  const angle = placement.rotationYRadians - before.rotationYRadians;
  const dy = target[1] - before.position[1];
  return Object.fromEntries(
    items.map((item) => {
      const { position, rotationYRadians } = resolveItemTransform(item.placement, floor);
      const dx = position[0] - before.position[0],
        dz = position[2] - before.position[2];
      const at = [
        (target[0] + dx * Math.cos(angle) + dz * Math.sin(angle)) / scale +
          floor.coordinates.origin[0],
        (target[2] - dx * Math.sin(angle) + dz * Math.cos(angle)) / scale +
          floor.coordinates.origin[1],
      ] as const;
      let next: ItemPlacement = {
        kind: "absolute",
        at,
        elevationMeters: position[1] + dy,
        rotationYRadians: rotationYRadians + angle,
      };
      const support = item.placement;
      if (
        support.kind === "ceiling" &&
        floor.rooms.some(
          (room) => room.id === support.roomId && pointInsidePolygon(at, room.polygon),
        )
      )
        next = {
          ...support,
          at,
          dropMeters: support.dropMeters - dy,
          rotationYRadians: next.rotationYRadians,
        };
      if (
        support.kind === "wall" &&
        Math.abs(angle) < 1e-10 &&
        Math.abs(target[0] - before.position[0]) < 1e-10 &&
        Math.abs(target[2] - before.position[2]) < 1e-10
      )
        next = { ...support, elevationMeters: support.elevationMeters + dy };
      return [item.id, next];
    }),
  );
}

export function groupPlacement(
  items: readonly SceneItemSpec[],
  floor: FloorSpec,
): Extract<ItemPlacement, { kind: "absolute" }> {
  const transform = itemGroupTransform(items, floor);
  return {
    kind: "absolute",
    at: [
      transform.position[0] / floor.coordinates.metersPerPlanUnit + floor.coordinates.origin[0],
      transform.position[2] / floor.coordinates.metersPerPlanUnit + floor.coordinates.origin[1],
    ],
    elevationMeters: transform.position[1],
    rotationYRadians: transform.rotationYRadians,
  };
}
