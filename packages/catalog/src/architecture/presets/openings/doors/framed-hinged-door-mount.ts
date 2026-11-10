import { DOOR_FRAME_JAMB_WIDTH_METERS } from "./door-frame-dimensions";

const JAMB_CLEARANCE_METERS = 0.003;
const MEETING_CLEARANCE_METERS = 0.003;

/** Mount a framed hinged leaf inside the jambs, pivoting on its opening-side face. */
export function framedHingedDoorMount(
  width: number,
  leafCount: 1 | 2,
  frameDepth: number,
  leafDepth: number,
  sideSign: -1 | 1,
  hingeFaceOffset = leafDepth / 2,
) {
  const inset = Math.min(DOOR_FRAME_JAMB_WIDTH_METERS / 2 + JAMB_CLEARANCE_METERS, width / 4);
  const closedWidth =
    (width - 2 * inset - (leafCount === 2 ? MEETING_CLEARANCE_METERS : 0)) / leafCount;
  // The rear latch corner swings beyond the closed leaf's X extent on thick/narrow doors.
  const radialClearance =
    leafCount === 2
      ? width / 2 - inset - MEETING_CLEARANCE_METERS / 2
      : width - inset - DOOR_FRAME_JAMB_WIDTH_METERS / 2 - 0.001;
  const sweptWidth = Math.sqrt(Math.max(0, radialClearance ** 2 - leafDepth ** 2));
  return {
    inset,
    leafWidth: Math.max(0.08, Math.min(closedWidth, sweptWidth)),
    pivotZ: (sideSign * frameDepth) / 2,
    leafZ: -sideSign * hingeFaceOffset,
  };
}
