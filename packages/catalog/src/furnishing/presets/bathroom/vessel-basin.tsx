import { Outlines, ToonMaterial } from "@cabane/engine";
import { Vector2 } from "three";

// The section returns over the lip and down to the waste, leaving the bowl open.
const porcelain = [
  [0.048, 0],
  [0.109, 0],
  [0.12, 0.005],
  [0.123, 0.015],
  [0.155, 0.031],
  [0.19, 0.061],
  [0.219, 0.104],
  [0.235, 0.156],
  [0.24, 0.193],
  [0.239, 0.198],
  [0.235, 0.2],
  [0.231, 0.198],
  [0.228, 0.192],
  [0.223, 0.158],
  [0.209, 0.111],
  [0.183, 0.075],
  [0.15, 0.05],
  [0.113, 0.035],
  [0.068, 0.028],
  [0.022, 0.025],
  [0.022, 0.012],
].map(([r, y]) => new Vector2(r, y));

export function VesselBasin({ color }: { color: string }) {
  return (
    <group name="vanity-vessel-basin">
      <mesh castShadow receiveShadow>
        <latheGeometry args={[porcelain, 32]} />
        <ToonMaterial color={color} />
        <Outlines color="#aca699" thickness={0.0012} screenspace={false} />
      </mesh>
      <mesh name="pop-up-drain" position={[0, 0.026, 0]}>
        <cylinderGeometry args={[0.025, 0.021, 0.006, 20]} />
        <ToonMaterial color="#a4aca9" />
      </mesh>
    </group>
  );
}
