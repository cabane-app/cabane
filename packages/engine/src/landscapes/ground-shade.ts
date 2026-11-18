import { DataTexture, LinearFilter, RedFormat } from "three";

// A static contact map anchors scenery without updating the home's shadow map.
const size = 512;
export const shadeExtent = 320;
export class GroundShade {
  private pixels = new Uint8Array(size * size);
  add(x: number, z: number, halfX: number, halfZ: number, rectangular = false) {
    const unit = size / shadeExtent;
    const cx = size / 2 + x * unit,
      cz = size / 2 + z * unit;
    const rx = halfX * unit,
      rz = halfZ * unit;
    for (let j = Math.max(0, Math.floor(cz - rz)); j <= Math.min(size - 1, cz + rz); j++) {
      for (let i = Math.max(0, Math.floor(cx - rx)); i <= Math.min(size - 1, cx + rx); i++) {
        const dx = Math.abs((i + 0.5 - cx) / rx),
          dz = Math.abs((j + 0.5 - cz) / rz);
        const d = rectangular ? Math.max(dx, dz) : Math.hypot(dx, dz);
        const coverage = Math.max(0, Math.min(1, (1 - d) * (rectangular ? 4 : 1.7)));
        const at = j * size + i;
        this.pixels[at] = Math.max(this.pixels[at], Math.round(255 * coverage));
      }
    }
  }
  texture() {
    const texture = new DataTexture(this.pixels, size, size, RedFormat);
    texture.magFilter = texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }
}
