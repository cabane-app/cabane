import { defineFurnishingModel } from "@cabane/engine";
import {
  DesktopPcTower,
  DESKTOP_PC_TOWER_SIZE,
  DesktopKeyboard,
  DESKTOP_KEYBOARD_SIZE,
  DesktopMouse,
  DESKTOP_MOUSE_SIZE,
} from "../presets/desktop-pc";

export const desktopPcDefinitions = {
  "desktop-pc-tower": defineFurnishingModel({
    component: DesktopPcTower,
    label: "Desktop PC tower",
    category: "Electronics",
    defaultRoomType: "office",
    defaultSize: DESKTOP_PC_TOWER_SIZE,
    bounds: { min: [-0.105, 0, -0.215], max: [0.105, 0.44, 0.215] },
    resizePolicy: { kind: "uniform" },
    preferredPlacement: "absolute",
    outlineContact: true,
    complexity: { visibleMeshes: 14, triangles: 6000 },
  }),
  "desktop-keyboard": defineFurnishingModel({
    component: DesktopKeyboard,
    label: "Desktop keyboard",
    category: "Electronics",
    defaultRoomType: "office",
    defaultSize: DESKTOP_KEYBOARD_SIZE,
    bounds: { min: [-0.22, 0, -0.075], max: [0.22, 0.03, 0.075] },
    resizePolicy: { kind: "uniform" },
    preferredPlacement: "absolute",
    outlineContact: true,
    complexity: { visibleMeshes: 2, triangles: 1300 },
  }),
  "desktop-mouse": defineFurnishingModel({
    component: DesktopMouse,
    label: "Desktop mouse",
    category: "Electronics",
    defaultRoomType: "office",
    defaultSize: DESKTOP_MOUSE_SIZE,
    bounds: { min: [-0.0325, 0, -0.0575], max: [0.0325, 0.04, 0.0575] },
    resizePolicy: { kind: "uniform" },
    preferredPlacement: "absolute",
    outlineContact: true,
    complexity: { visibleMeshes: 2, triangles: 800 },
  }),
};
