import type { FloorCoordinates, PlanPoint } from "@cabane/engine";
import { constructPlanToWorld } from "./drag-geometry";

const MEASUREMENT_DECIMAL_PLACES = 2;
const MIN_VISIBLE_MEASUREMENT_METERS = 1e-6;

export type ConstructMeasurePhase = "idle" | "drawing" | "complete";

export interface ConstructMeasureState {
  readonly start: PlanPoint | null;
  readonly preview: PlanPoint | null;
  readonly end: PlanPoint | null;
}

export type ConstructMeasureAction =
  | { readonly type: "place"; readonly point: PlanPoint }
  | { readonly type: "preview"; readonly point: PlanPoint }
  | { readonly type: "cancel" }
  | { readonly type: "reset" };

export interface ConstructMeasurement {
  readonly from: PlanPoint;
  readonly to: PlanPoint;
  readonly deltaPlanUnits: PlanPoint;
  readonly distancePlanUnits: number;
  readonly distanceMeters: number;
  readonly label: string;
  readonly copyText: string;
  /** "5.00 plan units"; display layers reformat the meters part per unit preference. */
  readonly planUnitsLabel: string;
  readonly world: {
    readonly from: readonly [x: number, z: number];
    readonly to: readonly [x: number, z: number];
    readonly center: readonly [x: number, z: number];
    readonly lengthMeters: number;
    readonly rotationYRadians: number;
  };
}

export const createConstructMeasureState = (): ConstructMeasureState => ({
  start: null,
  preview: null,
  end: null,
});

const copyPlanPoint = (point: PlanPoint): PlanPoint => [point[0], point[1]];

export const constructMeasurePhase = (state: ConstructMeasureState): ConstructMeasurePhase =>
  state.end ? "complete" : state.start ? "drawing" : "idle";

export const constructMeasureReducer = (
  state: ConstructMeasureState,
  action: ConstructMeasureAction,
): ConstructMeasureState => {
  switch (action.type) {
    case "place":
      if (!state.start || state.end) {
        return {
          start: copyPlanPoint(action.point),
          preview: null,
          end: null,
        };
      }
      return {
        start: state.start,
        preview: null,
        end: copyPlanPoint(action.point),
      };
    case "preview":
      if (!state.start || state.end) return state;
      return {
        ...state,
        preview: copyPlanPoint(action.point),
      };
    case "cancel":
    case "reset":
      return createConstructMeasureState();
  }
};

export const constructMeasureGuidePoints = (
  state: ConstructMeasureState,
): readonly [from: PlanPoint, to: PlanPoint] | null => {
  if (!state.start) return null;
  const to = state.end ?? state.preview;
  return to ? [state.start, to] : null;
};

export const formatConstructDistance = (value: number) => {
  const rounded = Number(value.toFixed(MEASUREMENT_DECIMAL_PLACES));
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(MEASUREMENT_DECIMAL_PLACES);
};

export const measureConstructPoints = (
  from: PlanPoint,
  to: PlanPoint,
  coordinates: FloorCoordinates,
): ConstructMeasurement => {
  const deltaPlanUnits: PlanPoint = [to[0] - from[0], to[1] - from[1]];
  const distancePlanUnits = Math.hypot(...deltaPlanUnits);
  const distanceMeters = distancePlanUnits * coordinates.metersPerPlanUnit;
  const worldFrom = constructPlanToWorld(from, coordinates);
  const worldTo = constructPlanToWorld(to, coordinates);
  const formattedPlanUnits = formatConstructDistance(distancePlanUnits);
  const formattedMeters = formatConstructDistance(distanceMeters);
  // Kept in metric so non-React consumers (and scene userData) stay stable; display
  // components reformat the distance part for the viewer's unit preference.
  const label = `${formattedPlanUnits} plan units · ${formattedMeters} m`;
  const planUnitsLabel = `${formattedPlanUnits} plan units`;

  return {
    from,
    to,
    deltaPlanUnits,
    distancePlanUnits,
    distanceMeters,
    label,
    planUnitsLabel,
    copyText: label,
    world: {
      from: worldFrom,
      to: worldTo,
      center: [(worldFrom[0] + worldTo[0]) / 2, (worldFrom[1] + worldTo[1]) / 2],
      lengthMeters: distanceMeters,
      rotationYRadians:
        distanceMeters <= MIN_VISIBLE_MEASUREMENT_METERS
          ? 0
          : -Math.atan2(worldTo[1] - worldFrom[1], worldTo[0] - worldFrom[0]),
    },
  };
};

export const constructMeasurementForState = (
  state: ConstructMeasureState,
  coordinates: FloorCoordinates,
) => {
  const points = constructMeasureGuidePoints(state);
  return points ? measureConstructPoints(points[0], points[1], coordinates) : null;
};

export const constructMeasurementIsVisible = (measurement: ConstructMeasurement | null) =>
  Boolean(measurement && measurement.world.lengthMeters > MIN_VISIBLE_MEASUREMENT_METERS);
