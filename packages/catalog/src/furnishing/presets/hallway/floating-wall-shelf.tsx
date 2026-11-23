import { useOakVeneer, type SceneItemSize } from "@cabane/engine";
import { ExtrudeGeometry, Shape } from "three";
import {
  cabinetBoard,
  CabinetPiece,
  horizontalTimber,
  joinCabinetParts,
} from "../construction/cabinet-joinery";
import { oakGrainTexture } from "../construction/oak-grain-texture";

export const FLOATING_WALL_SHELF_SIZE = [0.8, 0.22, 0.25] as const;

// A stepped front edge exposes a recessed shadow line under the shelf.
const board = horizontalTimber(cabinetBoard(0.8, 0.044, 0.245, 0, 0.198, 0.1275, 0.007));
const rebate = horizontalTimber(cabinetBoard(0.784, 0.021, 0.223, 0, 0.1695, 0.1185, 0.004));
const back = horizontalTimber(cabinetBoard(0.776, 0.082, 0.024, 0, 0.12, 0.023, 0.003));

function foldedBracket(x: number) {
  // Side elevation, drawn from the wall foot to the underside bearing surface.
  const profile = new Shape();
  profile.moveTo(0, 0);
  profile.lineTo(0.012, 0);
  profile.lineTo(0.012, 0.069);
  profile.quadraticCurveTo(0.026, 0.133, 0.122, 0.148);
  profile.lineTo(0.198, 0.148);
  profile.lineTo(0.198, 0.161);
  profile.lineTo(0, 0.161);
  profile.closePath();
  return new ExtrudeGeometry(profile, { depth: 0.023, bevelEnabled: false, curveSegments: 6 })
    .rotateY(-Math.PI / 2)
    .translate(x + 0.0115, 0, 0);
}
const brackets = joinCabinetParts([-0.27, 0.27].map(foldedBracket));

export function FloatingWallShelf({ size = FLOATING_WALL_SHELF_SIZE }: { size?: SceneItemSize }) {
  const veneer = useOakVeneer() ?? oakGrainTexture;
  return (
    <group name="floating-wall-shelf" scale={[size[0] / 0.8, size[1] / 0.22, size[2] / 0.25]}>
      <CabinetPiece
        name="floating-shelf-board"
        geometry={board}
        color="#d4af7a"
        map={veneer}
        outline="#a68a63"
      />
      <CabinetPiece geometry={rebate} color="#c49a68" map={veneer} />
      <CabinetPiece name="floating-shelf-back-lip" geometry={back} color="#c49a68" map={veneer} />
      <CabinetPiece name="shelf-wall-bracket" geometry={brackets} color="#747a75" />
    </group>
  );
}
