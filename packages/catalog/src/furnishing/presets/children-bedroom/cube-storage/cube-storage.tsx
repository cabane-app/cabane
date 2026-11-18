import { ToonMaterial, Outlines } from "@cabane/engine";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WovenCubeBin } from "./woven-cube-bin";
import { FoxFabricBin } from "./fox-fabric-bin";
import { StorageTopGiraffe } from "./storage-top-giraffe";
import { FRAME, FRAME_OUTLINE } from "./cube-storage-finish";

const caseParts = [
  ...[-0.39, 0.39].map((x) =>
    new RoundedBoxGeometry(0.07, 0.78, 0.34, 1, 0.007).translate(x, 0.39, 0),
  ),
  ...[0.035, 0.39, 0.745].map((y) =>
    new RoundedBoxGeometry(0.712, 0.07, 0.335, 1, 0.006).translate(0, y, 0),
  ),
  ...[0.2125, 0.5675].map((y) =>
    new RoundedBoxGeometry(0.07, 0.288, 0.33, 1, 0.006).translate(0, y, 0),
  ),
];
const casework = mergeGeometries(caseParts);
caseParts.forEach((part) => part.dispose());

export function CubeStorage({ color }: { color?: string | undefined } = {}) {
  return (
    <group name="kallax-bedroom-two-custom" userData={{ walkCollider: true }}>
      <mesh geometry={casework} castShadow receiveShadow>
        <ToonMaterial color={FRAME} />
        <Outlines color={FRAME_OUTLINE} thickness={0.0012} screenspace={false} />
      </mesh>
      <WovenCubeBin x={-0.195} y={0.21} />
      <WovenCubeBin x={0.195} y={0.21} />
      <WovenCubeBin x={0.195} y={0.565} />
      <FoxFabricBin color={color} />
      <StorageTopGiraffe />
    </group>
  );
}
