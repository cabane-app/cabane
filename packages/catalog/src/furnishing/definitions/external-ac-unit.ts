import { defineFurnishingModel } from "@cabane/engine";
import { ExternalAcUnit, EXTERNAL_AC_UNIT_SIZE } from "../presets/utility/external-ac-unit";

export const externalAcUnitDefinition = defineFurnishingModel({
  legacyOnly: true,
  component: ExternalAcUnit,
  label: "External AC unit",
  category: "Household",
  defaultRoomType: "outdoor",
  defaultSize: EXTERNAL_AC_UNIT_SIZE,
  bounds: { min: [-0.4, 0, -0.16], max: [0.4, 0.6, 0.16] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  placementEnvironment: "indoor-outdoor",
  outlineContact: true,
  complexity: { visibleMeshes: 37, triangles: 2800 },
});
