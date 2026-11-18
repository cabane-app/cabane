import { Outlines, ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { palette, StatusBeacon } from "../../visuals/device-visual-state";
import { turnedProfile } from "../../visuals/turned-profile";

const electrodes = mergeGeometries(
  Array.from({ length: 3 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / 3;
    return turnedProfile(
      [
        [0, 0],
        [0.013, 0],
        [0.017, 0.004],
        [0.017, 0.017],
        [0.013, 0.024],
        [0, 0.024],
      ],
      16,
    ).translate(0.071 * Math.sin(angle), 0, 0.071 * Math.cos(angle));
  }),
);
const boot = turnedProfile(
  [
    [0, 0.017],
    [0.077, 0.017],
    [0.093, 0.022],
    [0.099, 0.032],
    [0.1, 0.039],
    [0.097, 0.043],
    [0.092, 0.043],
  ],
  40,
);
const shell = turnedProfile(
  [
    [0, 0.038],
    [0.094, 0.038],
    [0.099, 0.043],
    [0.099, 0.053],
    [0.095, 0.061],
    [0.081, 0.07],
    [0.055, 0.078],
    [0.031, 0.08],
    [0, 0.08],
  ],
  40,
);
const drop = turnedProfile(
  [
    [0, 0.076],
    [0.022, 0.076],
    [0.028, 0.083],
    [0.031, 0.092],
    [0.03, 0.102],
    [0.024, 0.115],
    [0.014, 0.126],
    [0.006, 0.135],
    [0.001, 0.14],
    [0, 0.14],
  ],
  28,
);
// Offset the tip progressively for a swept, thumb-sized drop on the crown.
const vertices = drop.attributes.position;
for (let i = 0; i < vertices.count; i++) {
  const t = (vertices.getY(i) - 0.076) / 0.064;
  vertices.setX(i, vertices.getX(i) + 0.018 * t * t);
}
drop.computeVertexNormals();

export function LeakSensorModel({ visualState }: HomeDeviceModelProps) {
  const alert = visualState === "connected-active";
  return (
    <group name="catalog-leak-sensor">
      <mesh name="leak-electrodes" geometry={electrodes} castShadow>
        <ToonMaterial color="#bda98a" />
      </mesh>
      <mesh name="leak-rubber-boot" geometry={boot} castShadow>
        <ToonMaterial color="#465e5a" />
      </mesh>
      <mesh name="leak-housing" geometry={shell} castShadow receiveShadow>
        <ToonMaterial color="#e7e5d5" />
        <Outlines color="#697872" thickness={0.0008} screenspace={false} />
      </mesh>
      <mesh geometry={drop} userData={{ skipStaticBatch: true }}>
        <ToonMaterial color={alert ? palette.coral : "#79b9b3"} />
      </mesh>
      <StatusBeacon visualState={visualState} position={[-0.046, 0.0785, 0.005]} scale={0.23} />
    </group>
  );
}
