import { defineFurnishingModel } from "@cabane/engine";
import {
  ChildrenPendantGeometry,
  WovenPendantGeometry,
  TableLampModel,
  TABLE_LAMP_SIZE,
} from "../device/presets/lighting";
/** Preserve saved pre-device lighting items; Arrange offers their device replacements. */
export const legacyLightFurnishingDefinitions = {
  "table-lamp": defineFurnishingModel({
    legacyOnly: true,
    component: ({ size }) => (
      <group scale={[size[0] / 0.32, size[1] / 0.52, size[2] / 0.32]}>
        <TableLampModel visualState="connected-inactive" />
      </group>
    ),
    label: "Table lamp",
    category: "Lighting",
    defaultRoomType: "bedroom",
    defaultSize: TABLE_LAMP_SIZE,
    bounds: { min: [-0.16, 0, -0.16], max: [0.16, 0.52, 0.16] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    outlineContact: false,
    complexity: { visibleMeshes: 7, triangles: 3_200 },
  }),
  "woven-pendant": defineFurnishingModel({
    legacyOnly: true,
    defaultRoomType: "dining-room",
    component: ({ size }) => (
      <group scale={[size[0] / 0.847, size[1] / 0.58, size[2] / 0.86]}>
        <WovenPendantGeometry />
      </group>
    ),
    label: "Woven pendant",
    category: "Lighting",
    defaultSize: [0.847, 0.58, 0.86],
    bounds: { min: [-0.4235, -0.58, -0.43], max: [0.4235, 0, 0.43] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "ceiling",
    outlineContact: false,
    complexity: { visibleMeshes: 7, triangles: 4_800 },
  }),
  "children-pendant": defineFurnishingModel({
    legacyOnly: true,
    defaultRoomType: "bedroom",
    component: ({ size }) => (
      <group scale={[size[0] / 0.58, size[1] / 0.479, size[2] / 0.58]}>
        <ChildrenPendantGeometry />
      </group>
    ),
    label: "Children's pendant",
    category: "Children",
    defaultSize: [0.58, 0.479, 0.58],
    bounds: { min: [-0.29, -0.479, -0.29], max: [0.29, 0, 0.29] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "ceiling",
    outlineContact: false,
    complexity: { visibleMeshes: 9, triangles: 3_000 },
  }),
};
