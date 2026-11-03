import { defineDeviceModel } from "@cabane/engine";
import { TripodTelevisionModel, TRIPOD_TELEVISION_SIZE } from "./tripod-television";

export const tripodTelevisionDefinition = defineDeviceModel({
  component: TripodTelevisionModel,
  label: "Tripod television",
  category: "Media",
  defaultRoomType: "living-room",
  defaultSize: TRIPOD_TELEVISION_SIZE,
  bounds: { min: [-0.55, 0, -0.2], max: [0.55, 0.75, 0.2] },
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "absolute",
  supportedDomains: ["camera", "media_player", "switch"],
  mountKind: "surface",
  outlineContact: true,
  liveMedia: { kind: "camera-stream", slotRole: "primary" },
  interaction: { target: "camera-viewer", tapTolerancePixels: 10 },
  complexity: { visibleMeshes: 40, triangles: 1300 },
});
