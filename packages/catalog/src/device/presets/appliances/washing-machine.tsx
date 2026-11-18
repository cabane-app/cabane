import { BoxGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { turnedProfile } from "../../visuals/turned-profile";
import { Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { LaundryDrum } from "./laundry-drum";
import { StatusBeacon } from "../../visuals/device-visual-state";

const casework = new RoundedBoxGeometry(0.632, 0.865, 0.58, 1, 0.02);
const doorSeal = turnedProfile(
  [
    [0.229, 0.281],
    [0.24, 0.3],
    [0.238, 0.319],
    [0.226, 0.334],
    [0.204, 0.331],
    [0.192, 0.326],
    [0.176, 0.322],
    [0.17, 0.305],
    [0.149, 0.297],
    [0, 0.297],
  ],
  32,
);
const doorGlass = turnedProfile(
  [
    [0.19, 0.324],
    [0.166, 0.331],
    [0.125, 0.333],
    [0, 0.333],
  ],
  28,
);
const machinedTrim = mergeGeometries([
  turnedProfile(
    [
      [0.237, 0.311],
      [0.239, 0.318],
      [0.231, 0.329],
      [0.225, 0.335],
      [0.217, 0.335],
      [0.213, 0.332],
    ],
    32,
  )
    .rotateX(Math.PI / 2)
    .translate(0, 0.35, 0),
  new BoxGeometry(0.005, 0.023, 0.006).translate(0.023, 0.774, 0.319),
  ...[-1, 0, 1].map((i) =>
    new BoxGeometry(0.009, 0.011 + i * 0.003, 0.004).translate(
      0.145 + i * 0.016,
      0.746 + i * 0.0015,
      0.302,
    ),
  ),
]);
const detergentDrawer = new RoundedBoxGeometry(0.196, 0.086, 0.024, 1, 0.009);
const display = new RoundedBoxGeometry(0.149, 0.065, 0.022, 1, 0.01);
const selector = turnedProfile(
  [
    [0.051, 0.282],
    [0.051, 0.302],
    [0.047, 0.317],
    [0.039, 0.32],
    [0, 0.32],
  ],
  20,
);

export function WashingMachineModel({ visualState, reducedMotion }: HomeDeviceModelProps) {
  return (
    <group name="catalog-washing-machine" userData={{ walkCollider: true }}>
      <mesh geometry={casework} position={[0, 0.4325, -0.005]} castShadow receiveShadow>
        <ToonMaterial color="#e8e7e2" />
        <Outlines color="#777b78" thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh geometry={doorSeal} position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <ToonMaterial color="#394240" />
      </mesh>
      <mesh geometry={machinedTrim} castShadow>
        <ToonMaterial color="#a9b6b2" />
      </mesh>
      <mesh geometry={doorGlass} position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ToonMaterial color="#789091" transparent opacity={0.62} />
      </mesh>
      <mesh geometry={detergentDrawer} position={[-0.18, 0.746, 0.29]}>
        <ToonMaterial color="#d0d2ce" />
      </mesh>
      <mesh position={[-0.18, 0.735, 0.302]}>
        <boxGeometry args={[0.139, 0.012, 0.004]} />
        <ToonMaterial color="#68736e" />
      </mesh>
      <mesh geometry={selector} position={[0.023, 0.747, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ToonMaterial color="#63706b" />
      </mesh>
      <mesh geometry={display} position={[0.19, 0.746, 0.291]}>
        <ToonMaterial color="#283231" />
      </mesh>
      {visualState === "connected-active" && (
        <LaundryDrum position={[0, 0.35, 0.33]} radius={0.17} reducedMotion={reducedMotion} />
      )}
      <StatusBeacon visualState={visualState} position={[0.235, 0.748, 0.302]} scale={0.7} />
      <mesh position={[0.23, 0.09, 0.284]}>
        <boxGeometry args={[0.11, 0.13, 0.018]} />
        <ToonMaterial color="#deded9" />
      </mesh>
    </group>
  );
}
