import { defineFurnishingModel } from "@cabane/engine";
import { UsMailbox, US_MAILBOX_SIZE } from "../presets/utility/us-mailbox";

export const usMailboxDefinition = defineFurnishingModel({
  component: UsMailbox,
  label: "US mailbox",
  category: "Outdoor",
  defaultRoomType: "outdoor",
  defaultSize: US_MAILBOX_SIZE,
  bounds: { min: [-0.14, 0, -0.25], max: [0.14, 1.3, 0.25] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: false,
  complexity: { visibleMeshes: 8, triangles: 400 },
});
