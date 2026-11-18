import { tintableFinishTexture } from "../../../materials/tintable-finish-texture";

export const splitCane = tintableFinishTexture(128, "pendant-split-cane", (u, v) => {
  const warp = Math.cos(2 * Math.PI * (8 * u + 4 * v));
  const weft = Math.cos(2 * Math.PI * (8 * u - 4 * v));
  const upper = Math.cos(2 * Math.PI * 8 * u) > 0 ? warp : weft;
  return 0.925 + 0.045 * upper + 0.02 * Math.min(warp, weft);
});
splitCane.repeat.set(5, 1);

export const spunSlip = tintableFinishTexture(128, "pendant-spun-slip", (u, v) => {
  const drift = 0.18 * Math.sin(2 * Math.PI * u);
  return (
    0.965 +
    0.016 * Math.cos(2 * Math.PI * (9 * v) + drift) +
    0.012 * Math.cos(2 * Math.PI * (22 * v) + drift)
  );
});
