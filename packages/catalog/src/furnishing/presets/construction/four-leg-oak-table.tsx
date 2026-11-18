import type { BufferGeometry } from "three";
import { CabinetPiece } from "./cabinet-joinery";
import { oakGrainTexture } from "./oak-grain-texture";
import type { apronJoinery } from "./oak-table-joinery";

/** Shared finish and lighting targets for a worktop on four joined oak legs. */
export function FourLegOakTable({
  worktop,
  frame,
  stone = false,
}: {
  worktop: BufferGeometry;
  frame: ReturnType<typeof apronJoinery>;
  stone?: boolean;
}) {
  return (
    <>
      <CabinetPiece
        name="oak-table-top"
        geometry={worktop}
        color={stone ? "#eceae5" : "#d9b987"}
        {...(stone ? {} : { map: oakGrainTexture })}
        outline={stone ? "#aba89f" : "#a08861"}
      />
      <CabinetPiece
        name="oak-table-leg"
        geometry={frame.posts}
        color="#c8a675"
        map={oakGrainTexture}
      />
      <CabinetPiece
        name="oak-table-aprons"
        geometry={frame.rails}
        color="#c6a372"
        map={oakGrainTexture}
      />
      <CabinetPiece name="oak-table-joint-pegs" geometry={frame.pegs} color="#a88659" />
    </>
  );
}
