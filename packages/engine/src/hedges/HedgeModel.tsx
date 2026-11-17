import type { HedgeStyle } from "../types";
import { useContext } from "react";
import { useGraphicsFeature } from "../graphics-features";
import { SceneStyleContext } from "../scene-style";
import type { TerrainSurface } from "../terrain/terrain-surface";
import type { BoundaryDimensions } from "../boundaries/BoundaryBeam";
import type { MasonryMiters } from "../boundaries/masonry-miters";
import { TerrainHedge } from "./TerrainHedge";
import { BoxwoodCanopy } from "./BoxwoodCanopy";
import { ClippedHedge } from "./ClippedHedge";
import { NativeHedge } from "./NativeHedge";
import { IvyCoveredWall } from "./IvyCoveredWall";

import {
  PicketFence,
  PrivacyFence,
  PostRailFence,
  MetalBarFence,
  MasonryBoundary,
} from "../boundaries";

const models = {
  picket: PicketFence,
  privacy: PrivacyFence,
  "post-rail": PostRailFence,
  "metal-bars": MetalBarFence,

  clipped: ClippedHedge,
  "ivy-wall": IvyCoveredWall,
};
export function HedgeModel({
  style,
  terrain,
  masonryMiters,
  ...dimensions
}: BoundaryDimensions & {
  style: HedgeStyle;
  terrain?: TerrainSurface;
  masonryMiters?: MasonryMiters | undefined;
}) {
  const grounds = useGraphicsFeature("grounds");
  const natural = useContext(SceneStyleContext) === "default";
  let model;
  if (style === "rounded" || style === "bushy" || style === "mixed") {
    model = <NativeHedge style={style} {...dimensions} />;
  } else if (style === "masonry") {
    model = <MasonryBoundary {...dimensions} miters={masonryMiters} />;
  } else {
    const Model = grounds && natural && style === "clipped" ? BoxwoodCanopy : models[style];
    model = <Model {...dimensions} />;
  }
  return terrain ? <TerrainHedge terrain={terrain}>{model}</TerrainHedge> : model;
}
