import { DoubleSide } from "three";
import { ToonMaterial } from "@cabane/engine";
import { linenWeaveTexture } from "../../construction/linen-weave-texture";
import { eaveHeight, eaveZ, roofHeight } from "./timber";
import { textileSurface } from "./textile-surface";

function canopyWing(sign: number) {
  // Follow one length of cloth from the ridge, around the eave, down to its loose hem.
  return textileSurface(38, 40, (u, v) => {
    const slope = Math.min(1, v * 2),
      drop = Math.max(0, v * 2 - 1);
    const arch = Math.sin(Math.PI * slope);
    const folds =
      0.5 +
      0.5 *
        Math.cos(
          2 * Math.PI * (3.2 * u + 0.28 * u * u + 0.13 * drop * Math.sin(Math.PI * u) + 0.1 * arch),
        );
    const fluting = folds ** 1.6;
    const sag = Math.sin(Math.PI * u);
    const front = 0.503 - 0.52 * arch - 0.24 * (1 - slope) ** 3;
    const x = -0.558 + (front + 0.558) * u + drop * 0.032 * (u - 0.5);
    const hemY = 0.023 + 0.035 * folds + 0.019 * Math.sin(u * Math.PI * 3) ** 2;
    const outerZ = 1.176 + 0.04 * fluting;
    const eaveY = eaveHeight + 0.014 + 0.009 * fluting - 0.016 * sag;
    if (drop > 0) {
      const z = 1.18 + 0.029 * fluting + drop * (outerZ - 1.18 - 0.029 * fluting);
      return [x, eaveY + (hemY - eaveY) * drop, sign * z];
    }
    const z = slope * (1.18 + 0.029 * fluting);
    const y =
      roofHeight(slope * eaveZ) +
      0.014 +
      0.009 * slope * fluting -
      0.016 * slope * sag -
      arch * (0.078 + 0.065 * sag + 0.042 * (1 - fluting));
    return [x, y, sign * z];
  });
}
const panels = [-1, 1].map(canopyWing);

export function GatheredCurtains({ color }: { color: string }) {
  return (
    <>
      {panels.map((geometry, i) => (
        <mesh key={i} name="draped-coral-linen" geometry={geometry} castShadow receiveShadow>
          <ToonMaterial color={color} side={DoubleSide} map={linenWeaveTexture} />
        </mesh>
      ))}
    </>
  );
}
