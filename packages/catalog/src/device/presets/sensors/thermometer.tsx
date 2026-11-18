import { dialPrint, thermometerSweep } from "./thermometer-scale";
import { Outlines, ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { BoxGeometry, Path, Shape, ShapeGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { palette, StatusBeacon } from "../../visuals/device-visual-state";
import { turnedProfile } from "../../visuals/turned-profile";

const casework = turnedProfile(
  [
    [0, -0.001],
    [0.063, -0.001],
    [0.071, 0.002],
    [0.078, 0.009],
    [0.08, 0.017],
    [0.08, 0.029],
    [0.078, 0.036],
    [0.073, 0.04],
    [0.065, 0.04],
    [0.063, 0.034],
    [0, 0.034],
  ],
  48,
);
const rim = turnedProfile(
  [
    [0.064, 0.037],
    [0.073, 0.038],
    [0.074, 0.042],
    [0.071, 0.051],
    [0.068, 0.055],
    [0.065, 0.055],
    [0.062, 0.052],
    [0.061, 0.043],
    [0.061, 0.04],
  ],
  48,
);
const pivot = turnedProfile(
  [
    [0, 0.042],
    [0.004, 0.042],
    [0.004, 0.048],
    [0.007, 0.048],
    [0.007, 0.051],
    [0.005, 0.053],
    [0, 0.053],
  ],
  20,
);

const dial = new Shape();
dial.absarc(0, 0, 0.062, 0, Math.PI * 2, false);
for (const [y, halfWidth] of [
  [-0.029, 0.019],
  [-0.035, 0.016],
  [-0.041, 0.011],
]) {
  const slot = new Path();
  slot.absarc(-halfWidth, y, 0.0012, -Math.PI / 2, Math.PI / 2, true);
  slot.absarc(halfWidth, y, 0.0012, Math.PI / 2, -Math.PI / 2, true);
  slot.closePath();
  dial.holes.push(slot);
}
const dialFace = new ShapeGeometry(dial, 24);
const ticks = mergeGeometries(
  Array.from({ length: 21 }, (_, i) => {
    const major = i % 4 === 0;
    const length = major ? 0.009 : 0.004;
    return new BoxGeometry(major ? 0.0023 : 0.0011, length, 0.0007)
      .translate(0, 0.054 - length / 2, 0)
      .rotateZ((0.5 - i / 20) * thermometerSweep);
  }),
);
const hand = new Shape();
hand.moveTo(-0.003, -0.011);
hand.lineTo(0.003, -0.011);
hand.lineTo(0.0022, 0.009);
hand.lineTo(0, 0.046);
hand.lineTo(-0.0022, 0.009);
hand.closePath();
const needle = new ShapeGeometry(hand);

const numericState = (state: HomeDeviceModelProps["state"]) => {
  const value = Number(state?.state);
  return Number.isFinite(value) ? value : 20;
};

export function ThermometerModel({ state, visualState }: HomeDeviceModelProps) {
  const temperature = Math.max(-10, Math.min(40, numericState(state)));
  const angle = ((temperature + 10) / 50 - 0.5) * thermometerSweep;
  return (
    <group name="catalog-thermometer" position-y={0.08}>
      <mesh name="thermometer-case" geometry={casework} rotation-x={Math.PI / 2} castShadow>
        <ToonMaterial color="#536b69" />
        <Outlines color="#475b58" thickness={0.0008} screenspace={false} />
      </mesh>
      <mesh name="thermometer-rim" geometry={rim} rotation-x={Math.PI / 2}>
        <ToonMaterial color="#c7b398" />
      </mesh>
      <mesh name="thermometer-vented-dial" geometry={dialFace} position-z={0.043}>
        <ToonMaterial color="#efe8d6" map={dialPrint} />
      </mesh>
      <mesh geometry={ticks} position-z={0.04328}>
        <ToonMaterial color="#45635f" />
      </mesh>
      <mesh
        name="thermometer-needle"
        geometry={needle}
        position-z={0.0484}
        rotation-z={-angle}
        userData={{ skipStaticBatch: true }}
      >
        <ToonMaterial color={palette.coral} />
      </mesh>
      <mesh geometry={pivot} rotation-x={Math.PI / 2}>
        <ToonMaterial color="#506c67" />
      </mesh>
      <group rotation-x={Math.PI / 2}>
        <StatusBeacon visualState={visualState} position={[0, 0.0434, 0.02]} scale={0.15} />
      </group>
    </group>
  );
}
