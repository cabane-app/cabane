import { SingleBedQuilt } from "./single-bed-quilt";
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
            <cylinderGeometry args={[0.042, 0.026, 0.19, 8]} />
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
          <SingleBedQuilt color={color ?? "#e3d8c4"} throwColor="#afa88d" />
          <RoundedFurniturePanel
            name="single-bed-pillow"
            size={[0.61, 0.105, 0.36]}
            position={[0, 0.59, -0.69]}
            color={color ?? "#f2eee4"}
            radius={0.045}
            outlineColor="#b5ac9b"
          />
        </>
      )}
    </group>
  );
}
