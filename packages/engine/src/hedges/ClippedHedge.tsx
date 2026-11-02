import { ClippedHedgeFoliage } from "./ClippedHedgeFoliage";
import { ToonMaterial } from "../rendering";

export function ClippedHedge({
  length,
  height,
  width,
}: {
  length: number;
  height: number;
  width: number;
}) {
  const capHeight = 0.05;
  const bodyHeight = height - capHeight;
  return (
    <group>
      <ClippedHedgeFoliage length={length} height={height} width={width} />
      <mesh position={[0, bodyHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, bodyHeight, width]} />
        <ToonMaterial color="#436e38" />
      </mesh>
      <mesh position={[0, height - capHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, capHeight, width]} />
        <ToonMaterial color="#668847" />
      </mesh>
    </group>
  );
}
