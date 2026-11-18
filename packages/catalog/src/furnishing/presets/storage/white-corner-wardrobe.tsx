import { type SceneItemSize } from "@cabane/engine";
import { ExtrudeGeometry, Shape } from "three";
import { CabinetPiece, cabinetBoard, joinCabinetParts } from "../construction/cabinet-joinery";

export const WHITE_CORNER_WARDROBE_SIZE = [1.8, 2.35, 1.2] as const;

// One L-shaped board keeps the cap and the inside elbow continuous. The
// dimensions below are those of the finished profile, including the chamfer.
function cornerProfile(inset: number, bottom: number, height: number, bevel: number) {
  const margin = inset + bevel;
  const profile = new Shape();
  profile.moveTo(-0.9 + margin, 0.6 - margin);
  profile.lineTo(0.9 - margin, 0.6 - margin);
  profile.lineTo(0.9 - margin, margin);
  profile.lineTo(-0.3 - margin, margin);
  profile.lineTo(-0.3 - margin, -0.6 + margin);
  profile.lineTo(-0.9 + margin, -0.6 + margin);
  profile.closePath();
  return new ExtrudeGeometry(profile, {
    depth: height - 2 * bevel,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
  })
    .rotateX(-Math.PI / 2)
    .translate(0, bottom + bevel, 0);
}
const plinth = cornerProfile(0.035, 0, 0.07, 0.004);
const casework = cornerProfile(0.009, 0.07, 2.23, 0.006);
const crown = cornerProfile(0, 2.3, 0.05, 0.007);
const leaf = cabinetBoard(0.578, 2.19, 0.032, 0, 1.185, 0.004, 0.009);
const bead = joinCabinetParts(
  [-1, 1].map((side) => cabinetBoard(0.009, 2.075, 0.007, side * 0.248, 1.185, 0.021, 0.003)),
);

const grip = joinCabinetParts([
  cabinetBoard(0.037, 0.263, 0.008, 0, 0, 0.022, 0.004),
  ...[-0.108, 0.108].map((y) => cabinetBoard(0.018, 0.022, 0.025, 0, y, 0.036)),
  cabinetBoard(0.021, 0.237, 0.016, 0, 0, 0.049),
]);

function CornerDoor({ handleSide, name }: { handleSide: number; name: string }) {
  return (
    <>
      <CabinetPiece name={name} geometry={leaf} color="#f2eee5" outline="#aaa293" />
      <CabinetPiece geometry={bead} color="#d7cbbc" />
      <group position={[handleSide * 0.204, 1.15, 0]}>
        <CabinetPiece geometry={grip} color="#8c7253" />
      </group>
    </>
  );
}

export function WhiteCornerWardrobe({
  size = WHITE_CORNER_WARDROBE_SIZE,
}: {
  size?: SceneItemSize;
}) {
  return (
    <group
      name="white-corner-wardrobe"
      scale={[size[0] / 1.8, size[1] / 2.35, size[2] / 1.2]}
      userData={{ walkCollider: true }}
    >
      <CabinetPiece geometry={plinth} color="#b5a895" />
      <CabinetPiece geometry={casework} color="#dfd9cc" />
      <CabinetPiece geometry={crown} color="#f1efe9" outline="#aaa89f" />
      {[0, 0.6].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <CornerDoor name="corner-wardrobe-long-door" handleSide={x === 0 ? 1 : -1} />
        </group>
      ))}
      <group position={[-0.3, 0, 0.3]} rotation={[0, Math.PI / 2, 0]}>
        <CornerDoor name="corner-wardrobe-return-door" handleSide={-1} />
      </group>
    </group>
  );
}
