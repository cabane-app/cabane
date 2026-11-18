import type { SceneItemSize } from "@cabane/engine";
import {
  cabinetBoard,
  CabinetPiece,
  horizontalTimber,
  joinCabinetParts,
} from "../construction/cabinet-joinery";
import { oakGrainTexture } from "../construction/oak-grain-texture";

export const OAK_BOOKSHELF_SIZE = [0.8, 1.9, 0.3] as const;

const plinth = horizontalTimber(cabinetBoard(0.746, 0.069, 0.245, 0, 0.0345, -0.008));
const sides = joinCabinetParts(
  [-1, 1].map((side) =>
    horizontalTimber(cabinetBoard(1.85, 0.025, 0.3, 0, 0, 0, 0.003))
      .rotateZ(Math.PI / 2)
      .translate(side * 0.3875, 0.975, 0),
  ),
);
// Two inset back panels meet in a fine vertical reveal behind the shelf boards.
const backs = joinCabinetParts(
  [-1, 1].map((side) =>
    horizontalTimber(cabinetBoard(1.825, 0.376, 0.012, 0, 0, 0, 0.0015))
      .rotateZ(Math.PI / 2)
      .translate(side * 0.1885, 0.968, -0.142),
  ),
);
// Seat each end 3 mm into its upright. The solid front lippings stand proud of the core.
const levels = [0.08, 0.44, 0.8, 1.16, 1.52, 1.885];
const shelves = joinCabinetParts(
  levels.map((y) => horizontalTimber(cabinetBoard(0.756, 0.026, 0.271, 0, y, -0.006, 0.003))),
);
const lippings = joinCabinetParts(
  levels.map((y) => horizontalTimber(cabinetBoard(0.753, 0.03, 0.019, 0, y, 0.136, 0.004))),
);

/** Five usable shelf levels below the top board. */
export function OakBookshelf({ size = OAK_BOOKSHELF_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="oak-bookshelf"
      scale={[size[0] / 0.8, size[1] / 1.9, size[2] / 0.3]}
      userData={{ walkCollider: true }}
    >
      <CabinetPiece geometry={plinth} color="#b28f5f" />
      <CabinetPiece
        name="bookshelf-uprights"
        geometry={sides}
        color="#d1ae7c"
        map={oakGrainTexture}
      />
      <CabinetPiece geometry={backs} color="#b99768" map={oakGrainTexture} />
      <CabinetPiece
        name="bookshelf-shelf"
        geometry={shelves}
        color="#dabc8e"
        map={oakGrainTexture}
      />
      <CabinetPiece
        name="bookshelf-lippings"
        geometry={lippings}
        color="#d1ae7c"
        map={oakGrainTexture}
      />
    </group>
  );
}
