import type { ReactNode } from "react";
import { ToonMaterial, type ToonMaterialProps } from "../rendering";

export type LayeredSurfaceProps = Pick<
  ToonMaterialProps,
  "color" | "emissive" | "emissiveIntensity"
> & {
  /** Integer paint order: higher layers cover lower layers on the same local XY plane. */
  layer: number;
  name?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** A planar XY geometry; place and rotate the complete surface using a parent group. */
  children: ReactNode;
};

/** Opaque flat artwork with bounded depth bias and ordinary scene occlusion. */
export function LayeredSurface({
  layer,
  name,
  castShadow = false,
  receiveShadow = false,
  children,
  ...material
}: LayeredSurfaceProps) {
  if (!Number.isInteger(layer) || layer < 0 || layer > 64)
    throw new Error("LayeredSurface layer must be an integer from 0 to 64.");
  return (
    <mesh
      name={name ?? `surface-layer-${layer}`}
      position-z={layer * 0.00001}
      userData={{ cabaneSurfaceLayer: layer }}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      raycast={() => undefined}
    >
      {children}
      <ToonMaterial
        {...material}
        depthTest
        depthWrite
        transparent={false}
        polygonOffset
        polygonOffsetFactor={0}
        polygonOffsetUnits={-4 * layer}
      />
    </mesh>
  );
}
