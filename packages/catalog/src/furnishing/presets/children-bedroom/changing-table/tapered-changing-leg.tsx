import { Outlines, ToonMaterial } from "@cabane/engine";
import { WOOD } from "./changing-table-finish";

export function TaperedChangingLeg({ x, z }: { readonly x: number; readonly z: number }) {
  return (
    <mesh
      position={[x, 0.1, z]}
      rotation={[z < 0 ? -0.05 : 0.05, 0, x < 0 ? 0.05 : -0.05]}
      castShadow
    >
      <cylinderGeometry args={[0.022, 0.034, 0.2, 10]} />
      <ToonMaterial color={WOOD} />
      <Outlines color="#6e513b" thickness={0.0012} screenspace={false} />
    </mesh>
  );
}
