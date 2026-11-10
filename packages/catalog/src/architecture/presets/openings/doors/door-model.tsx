import { framedHingedDoorMount } from "./framed-hinged-door-mount";
import { omitUndefinedProperties } from "@cabane/engine";
import { RollUpDoorModel } from "./roll-up-door-model";
import {
  isGardenGate,
  openingWorldPlacement,
  resolveOpeningOrientation,
  wallLengthPlanUnits,
} from "@cabane/engine";
import type { DoorSpec } from "@cabane/engine";
import { AnimatedOpeningLeaf } from "../animation/animated-opening-leaf";
import { DoorFrame } from "./door-frame";
import { DoorLeaf } from "./door-leaf";
import type { OpeningModelProps } from "../opening-model-props";
import { PlankDoorRail } from "./plank-door-rail";
import { PLANK_DOOR_LEAF_DEPTH_METERS } from "./plank-door-leaf";
import {
  GARDEN_GATE_HINGE_OFFSET_METERS,
  GARDEN_GATE_SWEEP_DEPTH_METERS,
} from "./garden-gate-leaf";
import { gardenGateColor } from "../../../door-presets";
import { DOOR_FRAME_EXTRA_DEPTH_METERS } from "./door-frame-dimensions";

const PLANK_DOOR_WALL_GAP_METERS = 0.004;

export function DoorModel({
  wall,
  opening,
  floor,
  position,
  reducedMotion,
}: OpeningModelProps<DoorSpec>) {
  if (opening.operation === "roll-up")
    return (
      <RollUpDoorModel
        wall={wall}
        opening={opening}
        floor={floor}
        position={position}
        reducedMotion={reducedMotion}
      />
    );
  const placement = openingWorldPlacement(wall, opening, floor.coordinates);
  const orientation = resolveOpeningOrientation(opening);
  const paired = opening.leafCount === 2;
  const variant = opening.variant;
  const gate = isGardenGate(variant);
  const wallFrameDepth = wall.thicknessMeters + DOOR_FRAME_EXTRA_DEPTH_METERS;
  const frameDepth = gate ? Math.min(0.09, wallFrameDepth) : wallFrameDepth;
  // Opposing door leaves meet at the center instead of each losing clearance.
  const concealed = opening.variant === "concealed";
  const frontSign =
    opening.frontSide === undefined ? orientation.sideSign : opening.frontSide === "left" ? -1 : 1;
  const flush = opening.variant === "flush" || opening.variant === "flush-knob";
  const gap = paired ? 0 : flush || concealed ? 0.006 : 0.018;
  // A cabinet front overlays the jamb; the structural aperture stays clear of junctions.
  const overlay =
    flush && opening.variant !== "flush-knob" && !paired
      ? Math.max(
          0,
          Math.min(
            opening.frontOverlayMeters ?? 0.03,
            opening.offsetFromWallStartPlanUnits * floor.coordinates.metersPerPlanUnit,
            (wallLengthPlanUnits(wall) -
              opening.offsetFromWallStartPlanUnits -
              opening.widthPlanUnits) *
              floor.coordinates.metersPerPlanUnit,
          ),
        )
      : 0;
  const framedHinged =
    opening.operation === "hinged" &&
    !flush &&
    !concealed &&
    opening.variant !== "full-glass" &&
    opening.variant !== "steel-arched";
  const plankDepthScale =
    framedHinged && opening.variant === "plank"
      ? Math.min(1, placement.widthMeters / opening.leafCount / 0.4)
      : 1;
  const framedMount = framedHinged
    ? framedHingedDoorMount(
        placement.widthMeters,
        opening.leafCount,
        frameDepth,
        opening.variant === "panel" || opening.variant === "panel-white-lever"
          ? 0.05
          : opening.variant === "plank"
            ? 0.151 * plankDepthScale
            : gate
              ? GARDEN_GATE_SWEEP_DEPTH_METERS
              : 0.065,
        orientation.sideSign,
        opening.variant === "plank"
          ? 0.1185 * plankDepthScale
          : gate
            ? GARDEN_GATE_HINGE_OFFSET_METERS
            : undefined,
      )
    : null;
  const leafWidth =
    framedMount?.leafWidth ??
    Math.max(0.08, placement.widthMeters / opening.leafCount - gap + 2 * overlay);
  const edgeExtension = overlay > 0 ? overlay - gap / 2 : 0;
  const leafHeight = Math.max(
    0.08,
    opening.openingHeightMeters - (flush || concealed ? 0.026 : 0.03),
  );
  const frontMountedPlankDoor = opening.operation === "sliding" && opening.variant === "plank";
  const plankLeafCenterZ =
    wall.thicknessMeters / 2 + PLANK_DOOR_WALL_GAP_METERS + PLANK_DOOR_LEAF_DEPTH_METERS / 2;

  return (
    <group
      name={`opening-model-${opening.variant}`}
      position={[placement.start[0], opening.sillHeightMeters, placement.start[1]]}
      rotation={[0, placement.rotationY, 0]}
    >
      {opening.variant !== "full-glass" &&
        opening.variant !== "steel-arched" &&
        !flush &&
        !concealed && (
          <DoorFrame
            {...omitUndefinedProperties({
              color: opening.color ?? (gate ? gardenGateColor(variant, opening.finish) : undefined),
            })}
            depth={frameDepth}
            width={placement.widthMeters}
            height={opening.openingHeightMeters}
            openTop={gate}
          />
        )}
      {opening.operation === "sliding" && opening.variant === "plank" && (
        <PlankDoorRail
          width={placement.widthMeters}
          height={opening.openingHeightMeters}
          wallThickness={wall.thicknessMeters}
          leafWidth={leafWidth}
          orientation={orientation}
        />
      )}
      {orientation.leaves.map((leaf, index) => {
        const hinged = opening.operation === "hinged";
        const hingeAtEnd = hinged && leaf.hingeAtEnd;
        const segmentStart = leaf.startRatio * placement.widthMeters;
        const pivotX = hinged
          ? leaf.pivotRatio * placement.widthMeters +
            (framedMount
              ? hingeAtEnd
                ? -framedMount.inset
                : framedMount.inset
              : hingeAtEnd
                ? edgeExtension
                : -edgeExtension)
          : segmentStart - edgeExtension;
        const childX = hingeAtEnd ? -leafWidth / 2 : leafWidth / 2;
        const direction = hinged ? leaf.rotationSign : leaf.slideSign;

        return (
          <group
            key={index}
            {...omitUndefinedProperties({
              name: frontMountedPlankDoor ? "opening-plank-sliding-leaf-mount" : undefined,
            })}
            position={[
              pivotX,
              opening.openingHeightMeters / 2,
              frontMountedPlankDoor
                ? plankLeafCenterZ * orientation.sideSign
                : concealed
                  ? (wall.thicknessMeters / 2 - 0.025) * frontSign
                  : flush
                    ? (wall.thicknessMeters / 2 +
                        (opening.frontOverlayMeters === 0 ? -0.01 : 0.012)) *
                      orientation.sideSign
                    : (framedMount?.pivotZ ??
                      (paired ? 0 : index % 2 === 0 ? -0.016 : 0.016) * orientation.sideSign),
            ]}
          >
            <AnimatedOpeningLeaf
              operation={opening.operation}
              position={position}
              reducedMotion={reducedMotion}
              direction={direction}
              travel={leafWidth}
            >
              <group
                position={[childX, 0, framedMount?.leafZ ?? 0]}
                scale={[1, 1, orientation.sideSign]}
              >
                <DoorLeaf
                  opening={opening}
                  width={leafWidth}
                  height={leafHeight}
                  plankDepthScale={plankDepthScale}
                  handleSide={hinged ? leaf.extentSign : (-leaf.slideSign as -1 | 1)}
                />
              </group>
            </AnimatedOpeningLeaf>
          </group>
        );
      })}
    </group>
  );
}
