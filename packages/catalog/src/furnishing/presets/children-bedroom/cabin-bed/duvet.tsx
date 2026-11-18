import { ToonMaterial } from "@cabane/engine";
import { DoubleSide } from "three";
import { linenWeaveTexture } from "../../construction/linen-weave-texture";
import { textileSurface } from "./textile-surface";

const duvet = textileSurface(36, 32, (u, v) => {
  const t = Math.max(0, (u - 0.84) / 0.16);
  const bend = (Math.min(t * 2.1, 1) * Math.PI) / 2;
  const sideFlute = Math.sin(27 * v + 0.6 * Math.sin(v * 19));
  const x = -0.515 + 1.027 * Math.min(1, u / 0.84) + 0.046 * Math.sin(bend) + 0.006 * t * sideFlute;
  const endDrop = Math.max(0, (v - 0.94) / 0.06);
  const z =
    -0.46 +
    1.557 * Math.min(1, v / 0.94) +
    0.023 * Math.sin((endDrop * Math.PI) / 2) +
    0.028 * (1 - v) ** 4 * Math.sin(u * 7);
  const cuff = 0.022 * Math.exp(-((v - 0.066) ** 2) / 0.0007);
  const wrinkles = 0.006 * Math.sin(17 * v + 6 * u) + 0.004 * Math.sin(29 * v - 10 * u);
  const y =
    0.412 +
    cuff +
    wrinkles +
    0.014 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) -
    0.047 * (1 - Math.cos(bend)) -
    0.09 * Math.max(0, (t - 0.48) / 0.52) -
    0.048 * endDrop ** 1.5;
  return [x, y, z];
});
export function IvoryDuvet() {
  return (
    <mesh geometry={duvet} name="turned-ivory-duvet" castShadow receiveShadow>
      <ToonMaterial color="#f3ebdb" map={linenWeaveTexture} side={DoubleSide} />
    </mesh>
  );
}
