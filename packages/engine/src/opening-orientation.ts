import type { DoorSpec, WindowSpec } from "./types";

export type OrientableOpening =
  | Pick<
      DoorSpec,
      "kind" | "operation" | "leafCount" | "hingeSide" | "openingSide" | "slideDirection"
    >
  | Pick<
      WindowSpec,
      "kind" | "operation" | "panelCount" | "hingeSide" | "openingSide" | "slideDirection"
    >;

export type OpeningOrientationAction = "hinge" | "side" | "slide";

export function changeOpeningOrientation<T extends OrientableOpening>(
  opening: T,
  action: OpeningOrientationAction,
): T {
  const orientation = resolveOpeningOrientation(opening);
  if (action === "hinge" && orientation.canSwapHinge) {
    return { ...opening, hingeSide: opening.hingeSide === "end" ? "start" : "end" };
  }
  if (action === "side" && orientation.canSwitchSide) {
    return { ...opening, openingSide: opening.openingSide === "left" ? "right" : "left" };
  }
  if (action === "slide" && orientation.canReverseSlide) {
    return { ...opening, slideDirection: opening.slideDirection === "end" ? "start" : "end" };
  }
  return opening;
}

/** Wall-local X runs toward wall.to; positive Z is the wall's right face. */
export function resolveOpeningOrientation(opening: OrientableOpening) {
  const count = opening.kind === "door" ? opening.leafCount : opening.panelCount;
  const sideSign: -1 | 1 = opening.openingSide === "left" ? -1 : 1;
  const sliding = opening.operation === "sliding";
  const operable = opening.operation !== "fixed";
  const rollUp = opening.operation === "roll-up";
  return {
    sideSign,
    canSwapHinge: operable && !rollUp && !sliding && count === 1,
    canReverseSlide: sliding && (opening.kind === "window" || count === 1),
    canSwitchSide: operable,
    leaves: Array.from({ length: count ?? 0 }, (_, index) => {
      const hingeAtEnd =
        opening.kind === "window" && sliding
          ? false
          : count === 1
            ? opening.hingeSide === "end"
            : index === 1;
      const extentSign: -1 | 1 = hingeAtEnd ? -1 : 1;
      const slideSign: -1 | 1 =
        count === 2 && opening.kind === "door"
          ? index === 0
            ? -1
            : 1
          : opening.slideDirection === "end"
            ? 1
            : -1;
      return {
        hingeAtEnd,
        pivotRatio: (index + (hingeAtEnd ? 1 : 0)) / (count ?? 1),
        startRatio: index / (count ?? 1),
        widthRatio: 1 / (count ?? 1),
        extentSign,
        rotationSign: (-extentSign * sideSign) as -1 | 1,
        slideSign,
      };
    }),
  };
}
