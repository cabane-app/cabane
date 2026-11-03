import { defineFurnishingModel } from "@cabane/engine";
import { ElectricalPanel, ELECTRICAL_PANEL_SIZE } from "../presets/utility/electrical-panel";

export const electricalPanelDefinition = defineFurnishingModel({
  component: ElectricalPanel,
  label: "Electrical panel",
  category: "Household",
  defaultRoomType: "laundry",
  defaultSize: ELECTRICAL_PANEL_SIZE,
  bounds: { min: [-0.1, 0, 0], max: [0.1, 0.32, 0.1] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "wall",
  outlineContact: true,
  complexity: { visibleMeshes: 13, triangles: 2800 },
});
