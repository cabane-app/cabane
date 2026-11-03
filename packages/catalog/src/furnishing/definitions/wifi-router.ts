import { defineFurnishingModel } from "@cabane/engine";
import { WifiRouter, WIFI_ROUTER_SIZE } from "../presets/wifi-router";

export const wifiRouterDefinition = defineFurnishingModel({
  component: WifiRouter,
  label: "Wi-Fi router / internet box",
  category: "Electronics",
  defaultRoomType: "office",
  defaultSize: WIFI_ROUTER_SIZE,
  bounds: { min: [-0.12, 0, -0.082], max: [0.12, 0.2, 0.082] },
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 21, triangles: 2_500 },
});
