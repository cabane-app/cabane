import { ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { BoxGeometry, type BufferGeometry, DoubleSide, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { connectedLightBulbFinish } from "./connected-light-finish";
import { turnedProfile } from "../../visuals/turned-profile";

export const LOW_GARDEN_LANTERN_SIZE = [0.24, 0.35, 0.24] as const;

function squareSection(points: [number, number][]) {
  const profile: [number, number][] = points.map(([width, y]) => [width * Math.SQRT2, y]);
  const faces = Array.from({ length: 4 }, (_, side) => {
    const face = turnedProfile(profile, 1, Math.PI / 4 + (side * Math.PI) / 2, Math.PI / 2);
    face.computeVertexNormals();
    return face;
  });
  const section = mergeGeometries(faces);
  faces.forEach((face) => face.dispose());
  return section;
}
const iron: BufferGeometry[] = [
  turnedProfile(
    [
      [0, 0],
      [0.065, 0],
      [0.065, 0.009],
      [0.06, 0.015],
      [0.05, 0.019],
      [0.041, 0.056],
      [0.046, 0.068],
      [0, 0.068],
    ],
    16,
  ),
  squareSection([
    [0.038, 0.053],
    [0.067, 0.075],
    [0.075, 0.079],
    [0.075, 0.088],
    [0.069, 0.094],
    [0, 0.094],
  ]),
  squareSection([
    [0.096, 0.26],
    [0.106, 0.26],
    [0.109, 0.271],
    [0.099, 0.275],
    [0.096, 0.26],
  ]),
  turnedProfile(
    [
      [0.023, 0.092],
      [0.024, 0.104],
      [0.018, 0.109],
      [0.018, 0.139],
      [0, 0.139],
    ],
    12,
  ),
];
for (const x of [-1, 1]) {
  for (const z of [-1, 1]) {
    const bottom = new Vector3(x * 0.067, 0.086, z * 0.067);
    const top = new Vector3(x * 0.102, 0.269, z * 0.102);
    const axis = top.clone().sub(bottom);
    const center = bottom.lerp(top, 0.5);
    iron.push(
      new BoxGeometry(0.01, axis.length(), 0.01)
        .applyQuaternion(
          new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize()),
        )
        .translate(center.x, center.y, center.z),
    );
  }
}
const frame = mergeGeometries(iron);
iron.forEach((part) => part.dispose());
const roofParts = [
  squareSection([
    [0, 0.273],
    [0.116, 0.27],
    [0.12, 0.275],
    [0.12, 0.28],
    [0.106, 0.282],
    [0.044, 0.306],
    [0.029, 0.318],
    [0, 0.318],
  ]),
  turnedProfile(
    [
      [0.024, 0.315],
      [0.024, 0.321],
      [0.014, 0.324],
      [0.012, 0.332],
      [0.015, 0.337],
      [0.011, 0.344],
      [0, 0.35],
    ],
    12,
  ),
];
const cap = mergeGeometries(roofParts);
roofParts.forEach((part) => part.dispose());
const panes = squareSection([
  [0.065, 0.092],
  [0.099, 0.266],
]);
const bulb = turnedProfile(
  [
    [0.014, 0.135],
    [0.016, 0.149],
    [0.027, 0.162],
    [0.031, 0.179],
    [0.028, 0.193],
    [0.017, 0.204],
    [0, 0.208],
  ],
  12,
);

export function LowGardenLanternModel({ state, visualState }: HomeDeviceModelProps) {
  const finish = connectedLightBulbFinish(visualState, state);
  return (
    <group name={`device-state-${visualState}`} userData={{ walkCollider: true }}>
      <mesh name="garden-lantern-frame" geometry={frame} castShadow>
        <ToonMaterial color="#34423e" />
      </mesh>
      <mesh name="garden-lantern-eaves" geometry={cap} castShadow>
        <ToonMaterial color="#53605a" />
      </mesh>
      <mesh name="garden-lantern-glazing" geometry={panes}>
        <ToonMaterial
          color="#bfdbd1"
          transparent
          opacity={0.19}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh name="garden-lantern-bulb" geometry={bulb}>
        <ToonMaterial
          color={finish.color}
          emissive="#ffd28c"
          emissiveIntensity={finish.emissiveIntensity}
        />
      </mesh>
    </group>
  );
}
