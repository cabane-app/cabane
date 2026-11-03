import { defineFurnishingModel } from "@cabane/engine";
import { RobotLawnMower, ROBOT_LAWN_MOWER_SIZE } from "../presets/robot-lawn-mower";

export const robotLawnMowerDefinition = defineFurnishingModel({
  component: RobotLawnMower,
  label: "Robot lawn mower with charging station",
  category: "Garden",
  defaultRoomType: "outdoor",
  defaultSize: ROBOT_LAWN_MOWER_SIZE,
  bounds: { min: [-0.32, 0, -0.43], max: [0.32, 0.34, 0.43] },
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "absolute",
  placementEnvironment: "indoor-outdoor",
  outlineContact: true,
  complexity: { visibleMeshes: 15, triangles: 4200 },
});
