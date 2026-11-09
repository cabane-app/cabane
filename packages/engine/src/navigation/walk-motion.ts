import { polygonContact } from "./walk-polygon-collision";
import {
  BoxWalkCollider,
  SegmentWalkCollider,
  StickVector,
  WALK_CRUISE_SPEED,
  WALK_EDGE_BOOST_START,
  WALK_MAX_SPEED,
  WALK_PITCH_LIMIT,
  WALK_PLAYER_RADIUS,
  WalkCollider,
  WalkPoint,
} from "./walk-navigation-contract";

export const normalizeStickInput = (
  displacementX: number,
  displacementY: number,
  radius: number,
  deadZone = 0.12,
  exponent = 1.4,
): StickVector => {
  if (radius <= 0) return { x: 0, y: 0 };
  const rawMagnitude = Math.hypot(displacementX, displacementY) / radius;
  if (rawMagnitude <= deadZone) return { x: 0, y: 0 };
  const clampedMagnitude = Math.min(1, rawMagnitude);
  const remapped = (clampedMagnitude - deadZone) / (1 - deadZone);
  const response = remapped ** exponent;
  const inverseLength = 1 / Math.hypot(displacementX, displacementY);
  return {
    x: displacementX * inverseLength * response,
    y: displacementY * inverseLength * response,
  };
};

export const dampValue = (current: number, target: number, rate: number, delta: number) =>
  current + (target - current) * (1 - Math.exp(-rate * delta));

export const integrateWalkVelocity = (
  current: StickVector,
  input: StickVector,
  delta: number,
  cruiseSpeed = WALK_CRUISE_SPEED,
  acceleration = 10,
  deceleration = 14,
): StickVector => {
  const rawInputMagnitude = Math.hypot(input.x, input.y);
  const inputMagnitude = Math.min(1, rawInputMagnitude);
  const inputScale = rawInputMagnitude > 1 ? 1 / rawInputMagnitude : 1;
  const edgeProgress = Math.max(
    0,
    Math.min(1, (inputMagnitude - WALK_EDGE_BOOST_START) / (1 - WALK_EDGE_BOOST_START)),
  );
  const edgeMultiplier = 1 + edgeProgress * edgeProgress * (WALK_MAX_SPEED / WALK_CRUISE_SPEED - 1);
  const targetSpeed = cruiseSpeed * edgeMultiplier;
  const rate = inputMagnitude > 0 ? acceleration : deceleration;
  return {
    x: dampValue(current.x, input.x * inputScale * targetSpeed, rate, delta),
    y: dampValue(current.y, input.y * inputScale * targetSpeed, rate, delta),
  };
};

export const clampPitch = (pitch: number, limit = WALK_PITCH_LIMIT) =>
  Math.max(-limit, Math.min(limit, pitch));

export const closestPointOnSegment = (point: WalkPoint, from: WalkPoint, to: WalkPoint) => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const progress =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared),
        );
  return { x: from.x + dx * progress, z: from.z + dz * progress };
};

const resolveSegmentCollision = (
  point: WalkPoint,
  collider: SegmentWalkCollider,
  radius: number,
) => {
  const closest = closestPointOnSegment(point, collider.from, collider.to);
  let dx = point.x - closest.x;
  let dz = point.z - closest.z;
  let distance = Math.hypot(dx, dz);
  const minimum = radius + collider.halfThickness;
  if (distance >= minimum) return;
  if (distance < 1e-8) {
    const wallX = collider.to.x - collider.from.x;
    const wallZ = collider.to.z - collider.from.z;
    const length = Math.max(1e-8, Math.hypot(wallX, wallZ));
    dx = -wallZ / length;
    dz = wallX / length;
    distance = 1;
  }
  const correction = (minimum - distance) / distance;
  point.x += dx * correction;
  point.z += dz * correction;
};

const resolveBoxCollision = (point: WalkPoint, collider: BoxWalkCollider, radius: number) => {
  const closestX = Math.max(collider.minX, Math.min(point.x, collider.maxX));
  const closestZ = Math.max(collider.minZ, Math.min(point.z, collider.maxZ));
  const dx = point.x - closestX;
  const dz = point.z - closestZ;
  const distance = Math.hypot(dx, dz);
  if (distance >= radius) return;
  if (distance > 1e-8) {
    const correction = (radius - distance) / distance;
    point.x += dx * correction;
    point.z += dz * correction;
    return;
  }
  const choices = [
    { amount: Math.abs(point.x - collider.minX), x: collider.minX - radius, z: point.z },
    { amount: Math.abs(collider.maxX - point.x), x: collider.maxX + radius, z: point.z },
    { amount: Math.abs(point.z - collider.minZ), x: point.x, z: collider.minZ - radius },
    { amount: Math.abs(collider.maxZ - point.z), x: point.x, z: collider.maxZ + radius },
  ].sort((left, right) => left.amount - right.amount);
  point.x = choices[0].x;
  point.z = choices[0].z;
};

export const resolveCircleMovement = (
  start: WalkPoint,
  movement: WalkPoint,
  colliders: readonly WalkCollider[],
  radius = WALK_PLAYER_RADIUS,
  maximumStep = 0.06,
): WalkPoint => {
  const result = { ...start };
  const distance = Math.hypot(movement.x, movement.z);
  const steps = Math.max(1, Math.ceil(distance / maximumStep));
  for (let step = 0; step < steps; step += 1) {
    result.x += movement.x / steps;
    result.z += movement.z / steps;
    for (let pass = 0; pass < 2; pass += 1) {
      for (const collider of colliders) {
        if (collider.kind === "segment") {
          resolveSegmentCollision(result, collider, radius);
        } else if (collider.kind === "polygon") {
          const contact = polygonContact(result, collider.points);
          if (contact.distance < radius) {
            result.x += contact.normal.x * (radius - contact.distance);
            result.z += contact.normal.z * (radius - contact.distance);
          }
        } else {
          resolveBoxCollision(result, collider, radius);
        }
      }
    }
  }
  return result;
};
