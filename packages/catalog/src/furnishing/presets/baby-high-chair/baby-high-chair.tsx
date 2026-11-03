import type { SceneItemSize, SceneModelProps } from "@cabane/engine";
import { AntilopChair } from "./antilop-chair";
import { StokkeChair } from "./stokke-chair";

export const BABY_HIGH_CHAIR_SIZE: SceneItemSize = [0.56, 0.9, 0.6];

export function BabyHighChair({ size = BABY_HIGH_CHAIR_SIZE, variant }: Partial<SceneModelProps>) {
  return (
    <group
      name="baby-high-chair"
      userData={{ walkCollider: true }}
      scale={[size[0] / 0.56, size[1] / 0.9, size[2] / 0.6]}
    >
      {variant === "ikea-antilop" ? <AntilopChair /> : <StokkeChair />}
    </group>
  );
}
