import { tintableFinishTexture } from "../../../materials/tintable-finish-texture";

const tau = 2 * Math.PI;

export const linenWeaveTexture = tintableFinishTexture(128, "catalog-linen-weave", (u, v) => {
  const threads = 20;
  const warpIndex = Math.floor(u * threads);
  const weftIndex = Math.floor(v * threads);
  const warp = Math.sin(Math.PI * (u * threads - warpIndex));
  const weft = Math.sin(Math.PI * (v * threads - weftIndex));
  const top = (warpIndex + weftIndex) % 2 === 0 ? warp : weft;
  const bottom = Math.min(warp, weft);
  const slub = (1 + Math.cos(tau * (21 * u + 3 * v))) / 2;
  return 0.86 + 0.085 * top + 0.026 * bottom + 0.022 * slub;
});
