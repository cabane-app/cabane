import { CatmullRomCurve3, Vector3 } from "three";
import { planPointToWorld } from "../../geometry";
import type { BoxWalkCollider } from "../../navigation/walk-navigation-contract";
import type { HomeManifest, PlanPoint, RenderableFloorSpec } from "../../types";
import { createWelcomeWalkNavigation } from "./welcome-walk-navigation";

const WALK_SPEED = 1.55;
const CLEARANCE_SAMPLE_SPACING = 0.05;

// An eye-level tour of the bundled villa: past the dining table, along the
// garden windows, then back towards the kitchen. Coordinates are in plan units.
// The camera looks into the room as it moves, so it can linger on furnishings
// and the terrace instead of only looking straight down each aisle.
const VILLA_TOUR = [
  { at: [5.9, 12.05], yaw: -142 },
  { at: [9.1, 11.85], yaw: -154 },
  { at: [12.4, 11.95], yaw: 179 },
  { at: [13.1, 14.6], yaw: 108 },
  { at: [12.3, 16.85], yaw: 76 },
  { at: [8.55, 16.7], yaw: 68 },
  { at: [6.65, 15.95], yaw: 42 },
  { at: [6.05, 13.4], yaw: -65 },
] as const satisfies readonly { at: PlanPoint; yaw: number }[];

interface WelcomeWalkLoop {
  curve: CatmullRomCurve3;
  durationSeconds: number;
}

export function createWelcomeWalkLoop(
  manifest: HomeManifest,
  floor: RenderableFloorSpec,
  furniture: readonly BoxWalkCollider[] = [],
): WelcomeWalkLoop | null {
  const navigation = createWelcomeWalkNavigation(manifest, floor, furniture);
  if (!navigation) return null;

  const curve = new CatmullRomCurve3(
    VILLA_TOUR.map(({ at }) => {
      const [x, z] = planPointToWorld(at, floor.coordinates);
      return new Vector3(x, navigation.eyeHeight, z);
    }),
    true,
  );
  const length = curve.getLength();
  const sampleCount = Math.ceil(length / CLEARANCE_SAMPLE_SPACING);
  // Validate the rounded corners as well as the authored waypoints. A customized
  // demo whose room layout has changed can fall back to the orbit preview.
  for (let index = 0; index < sampleCount; index++) {
    const point = curve.getPointAt(index / sampleCount);
    if (!navigation.isClear(point)) return null;
  }
  return { curve, durationSeconds: length / WALK_SPEED };
}

export function sampleWelcomeWalkLoop(loop: WelcomeWalkLoop, elapsedSeconds: number) {
  const distance = (elapsedSeconds % loop.durationSeconds) * WALK_SPEED;
  const time = loop.curve.getUtoTmapping(0, distance);
  const position = loop.curve.getPoint(time);
  const segment = time * VILLA_TOUR.length;
  const index = Math.floor(segment) % VILLA_TOUR.length;
  const amount = segment - Math.floor(segment);
  const eased = amount * amount * (3 - 2 * amount);
  const fromYaw = VILLA_TOUR[index].yaw;
  const toYaw = VILLA_TOUR[(index + 1) % VILLA_TOUR.length].yaw;
  const turn = ((toYaw - fromYaw + 540) % 360) - 180;
  return {
    position: [position.x, position.y, position.z] as const,
    yaw: ((fromYaw + turn * eased) * Math.PI) / 180,
    pitch: (-3 * Math.PI) / 180,
  };
}
