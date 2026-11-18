import { BufferGeometry, Float32BufferAttribute, type Texture } from "three";
import { distanceToLawn, groundHeight, type FieldPlot } from "./country-survey";

function pixels(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

// A static subset of the actual near branches can cast filtered leaf shadows
// through the renderer's ordinary (cacheable) alpha-tested shadow pass.
export function canopyShadows(plot: FieldPlot, points: Texture, heights: Texture) {
  const samples = points.image as HTMLImageElement,
    heightmap = heights.image as HTMLImageElement;
  const data = pixels(samples),
    elevations = pixels(heightmap);
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const scale = plot.surveyScale,
    count = samples.width / 2;
  let seed = 930251;
  const random = () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
  const toMeters = (value: number) => (value / 255 - 0.5) * 384 * scale;
  for (let row = 0; row < samples.height; row++) {
    for (let col = 0; col < count; col += 2) {
      const i = (row * samples.width + col) * 4,
        root = i + count * 4;
      if (!data[i + 3]) continue;
      const x = toMeters(data[i]),
        z = toMeters(data[i + 1]);
      const edge = distanceToLawn(plot, x + plot.surveyX, z + plot.surveyZ);
      if (
        edge < -0.2 ||
        edge > 35 ||
        distanceToLawn(
          plot,
          toMeters(data[root]) + plot.surveyX,
          toMeters(data[root + 1]) + plot.surveyZ,
        ) < 1.4
      )
        continue;
      const hx = Math.round((data[i] / 255) * (heightmap.width - 1)),
        hz = Math.round((data[i + 1] / 255) * (heightmap.height - 1));
      const soil = (elevations[(hz * heightmap.width + hx) * 4] / 255) * 20 - 8.09;
      const height = (data[i + 2] / 255) * 45 - 8.09 - soil;
      const treeHeight = (data[root + 2] / 255) * 35;
      if (treeHeight > 5 && height < treeHeight * 0.25) continue;
      const y =
        groundHeight(plot, x + plot.surveyX, z + plot.surveyZ, soil) +
        Math.max(0.25, height) * scale;
      const yaw = random() * Math.PI * 2,
        size = (2.15 + random() * 0.9) * scale;
      const dx = Math.cos(yaw) * size,
        dz = Math.sin(yaw) * size,
        lift = (random() - 0.5) * size;
      const base = positions.length / 3,
        u = random() < 0.5 ? 0 : 0.5;
      for (const [a, b] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        positions.push(x + dx * a - dz * b * 0.7, y + lift * b, z + dz * a + dx * b * 0.7);
        uvs.push(u + (a + 1) * 0.25, (b + 1) * 0.5);
      }
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
