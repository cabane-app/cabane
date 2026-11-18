import { BoxGeometry, CylinderGeometry } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { turnedProfile } from "../../visuals/turned-profile";
import { Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { ActivityHologram } from "../../visuals/activity-hologram";
import { StatusBeacon } from "../../visuals/device-visual-state";

const cabinet = new RoundedBoxGeometry(0.572, 1.136, 0.409, 2, 0.061);
const crown = new RoundedBoxGeometry(0.563, 0.148, 0.399, 2, 0.067);
const manifoldCover = new RoundedBoxGeometry(0.39, 0.14, 0.31, 1, 0.045);
const controls = new RoundedBoxGeometry(0.123, 0.105, 0.029, 1, 0.014);
const fittingNuts = mergeGeometries(
  [-0.13, 0.13].map((x) => new CylinderGeometry(0.032, 0.032, 0.029, 6).translate(x, 0.159, 0)),
);
const dialFace = mergeGeometries([
  turnedProfile(
    [
      [0.047, 0.207],
      [0.048, 0.212],
      [0.044, 0.224],
      [0.041, 0.224],
      [0.038, 0.212],
    ],
    32,
  )
    .rotateX(Math.PI / 2)
    .translate(0, 0.415, 0),
  ...[-0.85, -0.425, 0, 0.425, 0.85].map((angle) =>
    new BoxGeometry(0.004, 0.01, 0.003)
      .translate(0, 0.032, 0)
      .rotateZ(angle)
      .translate(0, 0.415, 0.211),
  ),
]);
const supplyPipes = mergeGeometries(
  [-0.13, 0.13].map((x) =>
    turnedProfile(
      [
        [0, 0],
        [0.018, 0],
        [0.018, 0.138],
        [0.026, 0.142],
        [0.026, 0.178],
        [0.019, 0.181],
        [0.019, 0.24],
      ],
      12,
    ).translate(x, 0, 0),
  ),
);

export function WaterHeaterModel({ visualState, reducedMotion }: HomeDeviceModelProps) {
  return (
    <group name="catalog-water-heater">
      <mesh geometry={cabinet} position={[0, 0.796, -0.0015]} castShadow receiveShadow>
        <ToonMaterial color="#e8e5dc" />
        <Outlines color="#797b76" thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh geometry={crown} position={[0, 1.382, -0.0015]} castShadow>
        <ToonMaterial color="#ddd9cf" />
      </mesh>
      <mesh geometry={manifoldCover} position={[0, 0.245, 0]}>
        <ToonMaterial color="#c2c4bb" />
      </mesh>
      <mesh geometry={supplyPipes}>
        <ToonMaterial color="#9da4a1" />
      </mesh>
      <mesh geometry={fittingNuts}>
        <ToonMaterial color="#b38b5c" />
      </mesh>
      <mesh geometry={dialFace}>
        <ToonMaterial color="#b7c5b9" />
      </mesh>
      <mesh geometry={controls} position={[0, 0.42, 0.196]}>
        <ToonMaterial color="#384541" />
      </mesh>
      <StatusBeacon visualState={visualState} position={[0, 0.417, 0.208]} scale={0.53} />
      <ActivityHologram
        visualState={visualState}
        reducedMotion={reducedMotion}
        position={[0, 1.65, 0.24]}
      />
    </group>
  );
}
