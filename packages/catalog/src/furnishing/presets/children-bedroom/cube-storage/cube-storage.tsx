import { Outlines, ToonMaterial } from "@cabane/engine";
import { WovenCubeBin } from "./woven-cube-bin";
import { FoxFabricBin } from "./fox-fabric-bin";
import { StorageTopGiraffe } from "./storage-top-giraffe";
import { FRAME, FRAME_OUTLINE } from "./cube-storage-finish";

export function CubeStorage({ color }: { color?: string | undefined } = {}) {
  return (
    <group name="kallax-bedroom-two-custom" userData={{ walkCollider: true }}>
      {[-0.39, 0.39].map((x) => (
        <mesh key={x} position={[x, 0.39, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.07, 0.78, 0.34]} />
          <ToonMaterial color={FRAME} />
          <Outlines color={FRAME_OUTLINE} thickness={0.005} screenspace={false} />
        </mesh>
      ))}
      {[0.035, 0.39, 0.745].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.78, 0.07, 0.34]} />
          <ToonMaterial color={FRAME} />
          <Outlines color={FRAME_OUTLINE} thickness={0.005} screenspace={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.39, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.07, 0.71, 0.34]} />
        <ToonMaterial color={FRAME} />
      </mesh>

      <WovenCubeBin x={-0.195} y={0.215} />
      <WovenCubeBin x={0.195} y={0.215} />
      <WovenCubeBin x={0.195} y={0.565} />
      <FoxFabricBin color={color} />
      <StorageTopGiraffe />
    </group>
  );
}
