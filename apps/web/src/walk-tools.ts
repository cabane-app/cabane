import type { WalkToolDefinition } from "@cabane/engine";
import { laserWalkTool } from "@cabane/walk-laser";
import { createElement, lazy } from "react";
import { TorchlightBeam } from "./torchlight/TorchlightBeam";
import torchlightIcon from "./torchlight/icon.svg";

const torchlight: WalkToolDefinition = {
  id: "cabane.torchlight",
  label: "Torchlight",
  defaultShortcut: true,
  shortcutKey: "T",
  Icon: () => createElement("img", { src: torchlightIcon, alt: "", draggable: false }),
  WorldLighting: TorchlightBeam,
  Scene: lazy(() => import("./torchlight/Torchlight")),
};

/** Single installation point: engine and home packages know no experiments. */
export const installedWalkTools = [laserWalkTool, torchlight];
