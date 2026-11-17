import type { FloorSpec, PassageSpec, PlanPoint, WallSpec } from "../types";
import type { MultiPolygon } from "polygon-clipping";
import { differenceClippingGeometry, unionClippingPolygons } from "./architecture-clipping";
import { EPSILON, OPENING_CUT_MARGIN_METERS } from "./architecture-geometry-contract";
import { orientedWallPolygon } from "./wall-solid-footprints";
import { wallPlanePoint, type GableFace } from "./wall-gable-geometry";

export type PassageHead = { opening: PassageSpec; profile: readonly PlanPoint[] };

type Vertex = readonly [number, number, number];
export type WallTriangle = (a: Vertex, b: Vertex, c: Vertex, face: GableFace) => void;

/** Footprints of the solid gable immediately above this horizontal cut. */
function gableCover(solid: MultiPolygon, crown: number, wall: WallSpec, floor: FloorSpec) {
  return solid.flatMap((polygon) => {
    const crossings = polygon
      .flatMap((ring) =>
        ring.slice(1).flatMap(([b, by], i) => {
          const [a, ay] = ring[i];
          return ay > crown !== by > crown ? [a + ((b - a) * (crown - ay)) / (by - ay)] : [];
        }),
      )
      .sort((a, b) => a - b);
    return crossings.flatMap((start, i) =>
      i % 2 === 0 && crossings[i + 1] > start
        ? [orientedWallPolygon(wall, floor, start, crossings[i + 1])]
        : [],
    );
  });
}

export function appendPassageHead(
  { opening, profile }: PassageHead,
  wall: WallSpec,
  floor: FloorSpec,
  emit: WallTriangle,
  gableSolid: MultiPolygon | undefined,
  aboveContact: MultiPolygon,
  cap: (surface: MultiPolygon, height: number) => void,
) {
  const lift = wallPlanePoint(wall, floor, wall.thicknessMeters);
  const start = opening.offsetFromWallStartPlanUnits * floor.coordinates.metersPerPlanUnit;
  const crown = opening.openingHeightMeters + opening.sillHeightMeters;
  const needsCap = crown >= (wall.heightMeters ?? floor.defaultWallHeightMeters) - EPSILON;
  const sections: MultiPolygon = [];
  // The cut is slightly wider than the authored opening. Meet both actual jambs
  // so daylight cannot show through a hairline at either end of the arch.
  const section = ([s, y]: PlanPoint, adjustment = 0) => {
    const at: [number, number] = [start + s + adjustment, opening.sillHeightMeters + y];
    const top: [number, number] = [at[0], crown];
    return {
      station: at[0],
      left: lift(at, 1),
      right: lift(at, -1),
      leftTop: lift(top, 1),
      rightTop: lift(top, -1),
    };
  };
  if (profile.length < 2) return;
  let from = section(profile[0], -OPENING_CUT_MARGIN_METERS);
  for (let i = 1; i < profile.length; i++) {
    const to = section(profile[i], i === profile.length - 1 ? OPENING_CUT_MARGIN_METERS : 0);
    if (to.left[1] < crown) {
      emit(from.left, to.left, to.leftTop, "left");
      emit(from.right, to.rightTop, to.right, "right");
    }
    if (from.left[1] < crown) {
      emit(from.left, to.leftTop, from.leftTop, "left");
      emit(from.right, from.rightTop, to.rightTop, "right");
    }
    if (to.left[1] < crown || from.left[1] < crown) {
      emit(from.right, to.right, to.left, "edge");
      emit(from.right, to.left, from.left, "edge");
      if (needsCap) sections.push(orientedWallPolygon(wall, floor, from.station, to.station));
    }
    from = to;
  }
  if (sections.length) {
    const covers = gableSolid ? gableCover(gableSolid, crown, wall, floor) : [];
    const above = Math.abs(crown - floor.floorToFloorHeightMeters) < EPSILON ? aboveContact : [];
    cap(differenceClippingGeometry(unionClippingPolygons(sections), ...covers, above), crown);
  }
}
