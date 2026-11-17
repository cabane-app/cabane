import { useContext, type ComponentProps, type RefCallback } from "react";
import type { MeshStandardMaterial, MeshToonMaterial } from "three";
import { ToonMaterial } from "../rendering";
import { useGraphicsFeature } from "../graphics-features";
import { SceneStyleContext } from "../scene-style";

type SurfaceProps = Pick<
  ComponentProps<"meshStandardMaterial">,
  | "attach"
  | "aoMap"
  | "alphaMap"
  | "transparent"
  | "depthWrite"
  | "color"
  | "map"
  | "normalMap"
  | "vertexColors"
  | "side"
  | "polygonOffset"
  | "polygonOffsetFactor"
  | "polygonOffsetUnits"
> & {
  roughness?: number;
  feature?: "finishes" | "grounds";
  ref?: RefCallback<MeshStandardMaterial | MeshToonMaterial>;
};

/** Painted plaster, mineral surfaces and sealed wood share the scene light rig. */
export function ArchitecturalMaterial({
  roughness = 0.87,
  feature = "finishes",
  ...props
}: SurfaceProps) {
  const style = useContext(SceneStyleContext);
  const enabled = useGraphicsFeature(feature);
  return style === "sims" || !enabled ? (
    <ToonMaterial {...props} />
  ) : (
    <meshStandardMaterial {...props} roughness={roughness} />
  );
}
