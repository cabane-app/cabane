import { type SceneItemSize } from "@cabane/engine";
import { CabinetPiece, cabinetBoard, horizontalTimber } from "../construction/cabinet-joinery";
import { oakGrainTexture } from "../construction/oak-grain-texture";

export const OAK_FLOATING_SHELF_SIZE = [1.1, 0.035, 0.24] as const;
const board = horizontalTimber(cabinetBoard(1.1, 0.035, 0.24, 0, 0.0175, 0.12, 0.004));

/** One plain oak board with concealed fixings; back at Z=0, underside at Y=0. */
export function OakFloatingShelf({ size = OAK_FLOATING_SHELF_SIZE }: { size?: SceneItemSize }) {
  return (
    <group name="oak-floating-shelf" scale={[size[0] / 1.1, size[1] / 0.035, size[2] / 0.24]}>
      <CabinetPiece
        name="oak-floating-shelf-board"
        geometry={board}
        color="#b99164"
        map={oakGrainTexture}
        outline="#856a4d"
      />
    </group>
  );
}
