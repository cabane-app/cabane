import { LatheGeometry, Vector2 } from "three";
import { ToonMaterial } from "@cabane/engine";
import { PampasVase } from "../../decor";
import { CabinetBox } from "./cabinet-box";

const vase = new LatheGeometry(
  [
    [0, 0],
    [0.05, 0],
    [0.057, 0.009],
    [0.059, 0.022],
    [0.085, 0.046],
    [0.099, 0.078],
    [0.097, 0.117],
    [0.083, 0.146],
    [0.051, 0.167],
    [0.043, 0.19],
    [0.044, 0.212],
    [0.049, 0.216],
    [0.048, 0.22],
    [0.039, 0.22],
    [0.036, 0.209],
    [0.034, 0.18],
    [0, 0.175],
  ].map(([r, y]) => new Vector2(r, y)),
  28,
);

export function MediaWall() {
  return (
    <group name="mur-tv-salon-custom" userData={{ walkCollider: true }}>
      <CabinetBox width={2.25} height={0.4} columns={3} worktop={[2.31, 0.065, 0.43]} />
      <group position={[-1.65, 0, 0]}>
        <CabinetBox width={1.05} height={0.72} columns={2} worktop={[1.09, 0.06, 0.42]} />
        <mesh name="stoneware-bud-vase" geometry={vase} castShadow position={[0.22, 0.78, -0.04]}>
          <ToonMaterial color="#d6c0a2" />
        </mesh>
      </group>
      <group position={[0.92, 0.465, -0.08]}>
        <PampasVase />
      </group>
    </group>
  );
}
