import type { WalkToolDefinition } from "@cabane/engine";
import { laserWalkTool } from "@cabane/walk-laser";
import { createElement, lazy } from "react";
import { FlashlightBeam } from "./flashlight/FlashlightBeam";
import flashlightIcon from "./flashlight/icon.svg";

const flashlight: WalkToolDefinition = {
  // Persisted tool IDs survive display-name changes.
  id: "cabane.torchlight",
  label: "Flashlight",
  defaultShortcut: true,
  shortcutKey: "T",
  Icon: () => createElement("img", { src: flashlightIcon, alt: "", draggable: false }),
  WorldLighting: FlashlightBeam,
  Scene: lazy(() => import("./flashlight/Flashlight")),
};

/** Single installation point: engine and home packages know no experiments. */
export const installedWalkTools = [laserWalkTool, flashlight];
