import { DataTexture, LinearFilter, LinearMipmapLinearFilter, Vector4 } from "three";
import type { FieldPlot } from "./country-survey";
import type { gardenLayout } from "./garden-layout";

/** The soil, leaf litter and shorter grasses follow the same planting pockets. */
export function plantingMask(plot: FieldPlot, layout: ReturnType<typeof gardenLayout>) {
  const lot = plot.plantingLot,
    width = lot.width + 52,
    depth = lot.depth + 52;
  const left = lot.centerX - width / 2,
    top = lot.centerZ - depth / 2;
  const w = Math.max(32, Math.min(384, Math.ceil(width * 3))),
    h = Math.max(32, Math.min(384, Math.ceil(depth * 3)));
  const pixels = new Uint8Array(w * h * 4);
  function footprint(
    x: number,
    z: number,
    rx: number,
    rz: number,
    channel: number,
    amount: number,
  ) {
    const u = ((x + plot.surveyX - left) / width) * w,
      v = ((z + plot.surveyZ - top) / depth) * h,
      sx = (rx * w) / width,
      sz = (rz * h) / depth;
    for (let y = Math.max(0, Math.floor(v - sz)); y < Math.min(h, v + sz); y++) {
      for (let i = Math.max(0, Math.floor(u - sx)); i < Math.min(w, u + sx); i++) {
        const cover = Math.max(0, 1 - ((i + 0.5 - u) / sx) ** 2 - ((y + 0.5 - v) / sz) ** 2);
        const n = (y * w + i) * 4 + channel;
        pixels[n] = Math.max(pixels[n], Math.round(255 * amount * cover * cover * (3 - 2 * cover)));
      }
    }
  }
  for (const d of layout.drifts) footprint(d.x, d.z, d.rx * 1.12, d.rz * 1.12, 0, 0.72);
  for (const tree of layout.trees) {
    footprint(tree.x, tree.z, tree.size * 0.65, tree.size * 0.55, 2, 0.89);
  }
  for (const p of [...layout.trees, ...layout.shrubs, ...layout.stones]) {
    footprint(p.x, p.z, 0.22 + p.size * 0.41, 0.24 + p.size * 0.38, 1, 0.81);
    footprint(p.x, p.z, 0.5 + p.size * 0.29, 0.42 + p.size * 0.3, 0, 0.85);
  }
  const texture = new DataTexture(pixels, w, h);
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  function shelterAt(x: number, z: number) {
    const u = Math.floor(((x + plot.surveyX - left) * w) / width);
    const v = Math.floor(((z + plot.surveyZ - top) * h) / depth);
    if (u < 0 || u >= w || v < 0 || v >= h) return 0;
    return pixels[(v * w + u) * 4 + 2] / 255;
  }
  return { texture, bounds: new Vector4(left, top, width, depth), shelterAt };
}
