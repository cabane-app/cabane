import { CozySingleHeadboard, CozySingleBedding } from "./cozy-single-bed-details";
import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

/** A 90 × 200 cm mattress; the frame and headboard occupy 100 × 210 cm. */
export const SINGLE_BED_SIZE = [1, 0.95, 2.1] as const;

export function SingleBed({
  size = SINGLE_BED_SIZE,
  variant = "default",
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
  variant?: string;
}) {
  return (
    <group
      name="single-bed"
      scale={[size[0], size[1] / 0.95, size[2] / 2.1]}
      userData={{ walkCollider: true }}
    >
      {[-0.413, 0.413].flatMap((x) =>
        [-0.89, 0.89].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.095, z]} castShadow>
            <boxGeometry args={[0.055, 0.19, 0.055]} />
            <ToonMaterial color="#bf9a68" />
          </mesh>
        )),
      )}
      <RoundedFurniturePanel
        size={[0.99, 0.19, 2.06]}
        position={[0, 0.255, 0.02]}
        color="#d0ae7c"
        radius={0.012}
      />
      {variant !== "default" ? (
        <CozySingleHeadboard />
      ) : (
        <>
          <RoundedFurniturePanel
            name="single-bed-headboard"
            size={[1, 0.78, 0.055]}
            position={[0, 0.56, -1.0225]}
            color="#d3b484"
            radius={0.017}
          />
          <RoundedFurniturePanel
            name="single-bed-padded-headboard"
            size={[0.9, 0.49, 0.06]}
            position={[0, 0.67, -0.975]}
            color={color ?? "#cfc0a8"}
            radius={0.027}
          />
        </>
      )}
      <RoundedFurniturePanel
        name="single-bed-90x200-mattress"
        size={[0.9, 0.19, 2]}
        position={[0, 0.445, 0.03]}
        color="#efebdf"
        radius={0.036}
        outlineColor="#a8a08e"
      />
      {variant !== "default" ? (
        <CozySingleBedding variant={variant} color={color} />
      ) : (
        <>
          <RoundedFurniturePanel
            name="single-bed-duvet"
            size={[0.94, 0.085, 1.48]}
            position={[0, 0.5525, 0.285]}
            color={color ?? "#e3d8c4"}
            radius={0.035}
            outlineColor="#a99c85"
          />
          <RoundedFurniturePanel
            name="single-bed-pillow"
            size={[0.61, 0.105, 0.36]}
            position={[0, 0.59, -0.69]}
            color={color ?? "#f2eee4"}
            radius={0.045}
            outlineColor="#b5ac9b"
          />
          <RoundedFurniturePanel
            name="single-bed-folded-throw"
            size={[0.942, 0.035, 0.38]}
            position={[0, 0.6135, 0.62]}
            color="#afa88d"
            radius={0.012}
            outlineColor="#817e6b"
          />
        </>
      )}
    </group>
  );
}
