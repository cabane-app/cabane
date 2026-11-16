import { Outlines, type SceneItemSize, ToonMaterial } from "@cabane/engine";
import { Vector2 } from "three";

export const PEDESTAL_SIDE_TABLE_SIZE = [0.5, 0.55, 0.5] as const;

const foot = [
  [0, 0],
  [0.171, 0],
  [0.183, 0.005],
  [0.189, 0.014],
  [0.189, 0.023],
  [0.182, 0.033],
  [0.164, 0.039],
  [0.137, 0.043],
  [0.105, 0.056],
  [0.084, 0.072],
  [0.077, 0.083],
  [0, 0.083],
];
const spindle = [
  [0, 0.077],
  [0.075, 0.077],
  [0.079, 0.083],
  [0.079, 0.092],
  [0.07, 0.1],
  [0.062, 0.109],
  [0.061, 0.126],
  [0.069, 0.144],
  [0.075, 0.164],
  [0.075, 0.185],
  [0.07, 0.214],
  [0.056, 0.256],
  [0.046, 0.313],
  [0.044, 0.358],
  [0.046, 0.399],
  [0.055, 0.439],
  [0.071, 0.462],
  [0.083, 0.472],
  [0.089, 0.481],
  [0.089, 0.5],
  [0, 0.5],
];
const top = [
  [0, 0.493],
  [0.186, 0.493],
  [0.204, 0.498],
  [0.213, 0.504],
  [0.218, 0.513],
  [0.236, 0.518],
  [0.247, 0.525],
  [0.25, 0.532],
  [0.25, 0.542],
  [0.246, 0.548],
  [0.238, 0.55],
  [0, 0.55],
];
const parts = [
  { name: "dished-foot", profile: foot, color: "#ae8058" },
  { name: "turned-baluster", profile: spindle, color: "#ae8058" },
  { name: "bullnosed-oak-top", profile: top, color: "#cba67c" },
].map((part) => ({ ...part, profile: part.profile.map(([r, y]) => new Vector2(r, y)) }));
export function PedestalSideTable({
  size = PEDESTAL_SIDE_TABLE_SIZE,
}: { size?: SceneItemSize } = {}) {
  return (
    <group
      name="pedestal-side-table"
      scale={[size[0] / 0.5, size[1] / 0.55, size[2] / 0.5]}
      userData={{ walkCollider: true }}
    >
      {parts.map(({ name, profile, color }) => (
        <mesh key={name} name={name} castShadow receiveShadow>
          <latheGeometry args={[profile, 32]} />
          <ToonMaterial color={color} />
          {name === "bullnosed-oak-top" && (
            <Outlines color="#97734e" thickness={0.0015} screenspace={false} />
          )}
        </mesh>
      ))}
    </group>
  );
}
