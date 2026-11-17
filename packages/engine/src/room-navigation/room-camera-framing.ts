import { Spherical, Vector3 } from "three";
import { planPointToWorld } from "../geometry";
import type { FloorSpec, RoomSpec } from "../types";

export interface RoomFocusFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OrbitPose {
  target: Vector3;
  offset: Spherical;
  zoom: number;
}

// Every room arrives at the same comfortable three-quarter view.
const direction = new Vector3(0.82, 1.35, 0.92).normalize();
const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
const up = new Vector3().crossVectors(direction, right);

export function roomCameraFraming(
  floor: FloorSpec,
  room: RoomSpec,
  elevation: number,
  viewport: { width: number; height: number },
  frame: RoomFocusFrame,
): OrbitPose {
  const points = room.polygon.flatMap((point) => {
    const [x, z] = planPointToWorld(point, floor.coordinates);
    return [0, floor.defaultWallHeightMeters].map((y) => new Vector3(x, elevation + y, z));
  });
  return frameOrbitPoints(points, viewport, frame);
}

export function frameOrbitPoints(
  points: Vector3[],
  viewport: { width: number; height: number },
  frame: RoomFocusFrame,
): OrbitPose {
  const xs = points.map((point) => point.dot(right));
  const ys = points.map((point) => point.dot(up));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const zoom = Math.max(
    1,
    Math.min(
      160,
      (frame.width * 0.86) / Math.max(1, maxX - minX),
      (frame.height * 0.86) / Math.max(1, maxY - minY),
    ),
  );
  const center = points
    .reduce((sum, point) => sum.add(point), new Vector3())
    .divideScalar(points.length);
  // Center the projected bounds, including wall height, in the unobscured scene.
  center.addScaledVector(right, (minX + maxX) / 2 - center.dot(right));
  center.addScaledVector(up, (minY + maxY) / 2 - center.dot(up));
  center.addScaledVector(right, (viewport.width / 2 - frame.left - frame.width / 2) / zoom);
  center.addScaledVector(up, (frame.top + frame.height / 2 - viewport.height / 2) / zoom);
  return {
    target: center,
    offset: new Spherical().setFromVector3(direction.clone().multiplyScalar(35)),
    zoom,
  };
}

/** Exact critically damped motion: continuous velocity when a new room interrupts a glide. */
export function advanceRoomSpring(value: number, velocity: number, target: number, delta: number) {
  const omega = 12;
  const dt = Math.min(delta, 0.064);
  const distance = value - target;
  const decay = Math.exp(-omega * dt);
  const impulse = velocity + omega * distance;
  return {
    value: target + (distance + impulse * dt) * decay,
    velocity: (velocity - omega * impulse * dt) * decay,
  };
}

export const nearestOrbitAngle = (from: number, to: number) =>
  from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
