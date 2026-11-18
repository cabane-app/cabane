import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { CabinetPiece, cabinetBoard, joinCabinetParts } from "../construction/cabinet-joinery";
import { linenWeaveTexture } from "../construction/linen-weave-texture";
import { OfficeChairBase } from "./office-chair-base";
import { chairBackPanel, chairSeat } from "./office-chair-upholstery";

export const ERGONOMIC_OFFICE_CHAIR_SIZE = [0.68, 1.04, 0.68] as const;

const seat = chairSeat();
const shell = chairBackPanel(0.465, 0.473, 0.028, 0.567, -0.286);
const upholstery = chairBackPanel(0.422, 0.434, 0.038, 0.586, -0.264);
const lumbar = cabinetBoard(0.304, 0.068, 0.059, 0, 0.657, -0.231, 0.025);
const carriage = cabinetBoard(0.422, 0.056, 0.434, 0, 0.439, -0.005, 0.022);
const spine = cabinetBoard(0.065, 0.316, 0.039, 0, 0, 0, 0.016)
  .rotateX(-0.28)
  .translate(0, 0.565, -0.249);
const arms = joinCabinetParts(
  [-1, 1].flatMap((side) => [
    cabinetBoard(0.118, 0.03, 0.048, side * 0.253, 0.449, 0.008),
    cabinetBoard(0.031, 0.224, 0.045, side * 0.301, 0.553, 0.008, 0.009),
  ]),
);
const rests = joinCabinetParts(
  [-1, 1].map((side) => cabinetBoard(0.075, 0.042, 0.265, side * 0.3025, 0.673, 0.035, 0.02)),
);

export function ErgonomicOfficeChair({
  size = ERGONOMIC_OFFICE_CHAIR_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="ergonomic-office-chair"
      scale={[size[0] / 0.68, size[1] / 1.04, size[2] / 0.68]}
      userData={{ walkCollider: true }}
    >
      <OfficeChairBase />
      <CabinetPiece geometry={carriage} color="#646b64" />
      <CabinetPiece geometry={spine} color="#61685f" />
      <CabinetPiece
        name="office-chair-back-shell"
        geometry={shell}
        color="#899086"
        outline="#647065"
      />
      <CabinetPiece
        name="office-chair-padded-back"
        geometry={upholstery}
        color={color ?? "#e0d8c8"}
        map={linenWeaveTexture}
      />
      <CabinetPiece
        name="office-chair-lumbar-pad"
        geometry={lumbar}
        color={color ?? "#c9c1ae"}
        map={linenWeaveTexture}
      />
      <CabinetPiece
        name="office-chair-seat"
        geometry={seat}
        color={color ?? "#ddd4c2"}
        map={linenWeaveTexture}
        outline="#908b7c"
      />
      <CabinetPiece name="office-chair-arm-bracket" geometry={arms} color="#787f75" />
      <CabinetPiece name="office-chair-armrest" geometry={rests} color="#555d54" />
      <mesh
        name="office-chair-height-lever"
        position={[0.23, 0.423, -0.04]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
        <ToonMaterial color="#444b42" />
      </mesh>
    </group>
  );
}
