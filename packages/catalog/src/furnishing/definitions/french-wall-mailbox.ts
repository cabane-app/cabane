import { defineFurnishingModel } from "@cabane/engine";
import {
  FrenchWallMailbox,
  FRENCH_WALL_MAILBOX_SIZE,
} from "../presets/utility/french-wall-mailbox";

export const frenchWallMailboxDefinition = defineFurnishingModel({
  component: FrenchWallMailbox,
  label: "French wall mailbox",
  category: "Utility",
  defaultRoomType: "entryway",
  defaultSize: FRENCH_WALL_MAILBOX_SIZE,
  bounds: { min: [-0.15, 0, 0], max: [0.15, 0.4, 0.16] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "wall",
  outlineContact: false,
  complexity: { visibleMeshes: 8, triangles: 2300 },
});
