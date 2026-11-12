import { CatmullRomCurve3, Vector3 } from "three";
import { planPointToWorld } from "../../geometry";
import type { BoxWalkCollider } from "../../navigation/walk-navigation-contract";
import type { HomeManifest, RenderableFloorSpec } from "../../types";
import { createWelcomeWalkNavigation } from "./welcome-walk-navigation";
import { welcomeWalkTour } from "./welcome-walk-tour";

const WALK_SPEED = 1.55;
const CLEARANCE_SAMPLE_SPACING = 0.05;

interface WelcomeWalkLoop {
  curve: CatmullRomCurve3;
  durationSeconds: number;
  stops: NonNullable<ReturnType<typeof welcomeWalkTour>>["stops"];
}

export function createWelcomeWalkLoop(
  manifest: HomeManifest,
  floor: RenderableFloorSpec,
  furniture: readonly BoxWalkCollider[] = [],
): WelcomeWalkLoop | null {
  const navigation = createWelcomeWalkNavigation(manifest, floor, furniture);
  const tour = welcomeWalkTour(floor);
  if (!navigation || !tour) return null;

  const curve = new CatmullRomCurve3(
    tour.stops.map(({ at }) => {
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
  return { curve, durationSeconds: length / WALK_SPEED, stops: tour.stops };
}

export function sampleWelcomeWalkLoop(loop: WelcomeWalkLoop, elapsedSeconds: number) {
  const distance = (elapsedSeconds % loop.durationSeconds) * WALK_SPEED;
  const time = loop.curve.getUtoTmapping(0, distance);
  const position = loop.curve.getPoint(time);
  const segment = time * loop.stops.length;
  const index = Math.floor(segment) % loop.stops.length;
  const amount = segment - Math.floor(segment);
  const eased = amount * amount * (3 - 2 * amount);
  const fromYaw = loop.stops[index].yaw;
  const toYaw = loop.stops[(index + 1) % loop.stops.length].yaw;
  const turn = ((toYaw - fromYaw + 540) % 360) - 180;
  return {
    position: [position.x, position.y, position.z] as const,
    yaw: ((fromYaw + turn * eased) * Math.PI) / 180,
    pitch: (-3 * Math.PI) / 180,
  };
}
