import { resolveOpeningOrientation, type OpeningSpec } from "@cabane/engine";

/** Solid closed-leaf envelope in front of the wall centre; excludes the sill below the aperture. */
export function closedOpeningCoverClearance(opening: OpeningSpec, face: "left" | "right") {
  if (opening.kind === "window") {
    const frame =
      opening.variant === "steel-arched" ? 0.0225 : opening.glazing === "privacy" ? 0.0525 : 0.045;
    const handleFacesCover =
      resolveOpeningOrientation(opening).sideSign === (face === "left" ? -1 : 1);
    return {
      depthMeters:
        opening.operation === "casement" && handleFacesCover
          ? Math.max(frame, opening.glazing === "privacy" ? 0.121 : 0.1025)
          : frame,
      sillInsetMeters: opening.variant === "steel-arched" ? 0 : 0.015,
    };
  }
  // Full-glass sliding leaves have handles on both faces, plus up to 16 mm track offset.
  return opening.kind === "door" &&
    opening.operation === "sliding" &&
    opening.variant === "full-glass"
    ? { depthMeters: 0.088 + 0.016, sillInsetMeters: 0 }
    : null;
}
