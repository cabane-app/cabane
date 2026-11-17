import type { BoundaryDimensions } from "../boundaries/BoundaryBeam";
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from "three";

export type NativeHedgeStyle = "rounded" | "bushy" | "mixed";

export const nativeHedges = {
  rounded: { spring: "#899b60", mature: "#687f50", shoots: 15, shootLength: 0.111, tile: 0.73 },
  bushy: { spring: "#a0ac72", mature: "#778b51", shoots: 17, shootLength: 0.171, tile: 0.88 },
  mixed: { spring: "#91ad80", mature: "#577e5a", shoots: 14, shootLength: 0.226, tile: 1.06 },
};

export const oleanderAt = (x: number) => Math.sin(x * 3.07 + 1.9 * Math.sin(x * 0.88)) > 0.34;

export function canopyPoint(
  style: NativeHedgeStyle,
  { length, height, width }: BoundaryDimensions,
  x: number,
  angle: number,
  target: Vector3,
) {
  const distance = length / 2 - Math.abs(x);
  const tip = Math.max(0, 1 - distance / Math.min(width * 0.52, length * 0.42));
  const endRadius = Math.sqrt(Math.max(0, 1 - tip * tip));
  const along = x / Math.max(0.45, width);
  const top = Math.cos(angle);
  const side = Math.sin(angle);
  // Rounded privet has one sheared crown. The other species rise in uneven,
  // overlapping shoulders, with taller oleander among broader laurel.
  const roughness = style === "rounded" ? 0.027 : style === "bushy" ? 0.078 : 0.095;
  const shoulder =
    Math.sin(along * 4.2 + side * 1.4) * 0.52 +
    Math.sin(along * 8.7 - side * 2.3) * 0.28 +
    Math.sin(along * 2.8 + top * 7) * 0.2;
  const crown = 0.96 - roughness * (1 - shoulder);
  const center = 0.45 + (crown * 0.49 - 0.45) * endRadius;
  const skirt =
    style === "rounded"
      ? 0
      : Math.min(0.12 / height, 0.1) *
        Math.max(
          0,
          0.47 + 0.35 * Math.sin(along * 6 + side * 2.7) + 0.18 * Math.cos(along * 11.7 - side * 4),
        );
  const breadth = (style === "rounded" ? 0.95 : 0.89) + roughness * shoulder;
  const profile = Math.sign(side) * Math.abs(side) ** (style === "rounded" ? 0.88 : 0.75);
  const drift = roughness * 0.16 * Math.sin(along * 4.9);
  return target.set(
    x,
    height * (center + (top >= 0 ? crown - center : center - skirt) * top * endRadius),
    width * endRadius * ((breadth * 0.5 - Math.abs(drift)) * profile + drift),
  );
}

export function buildNativeHedgeCanopy(style: NativeHedgeStyle, size: BoundaryDimensions) {
  const columns = Math.min(
    256,
    Math.max(8, Math.ceil(size.length / Math.min(0.145, size.width * 0.22))),
  );
  const sides = 18;
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const point = new Vector3(),
    previous = new Vector3();
  const plant = nativeHedges[style];
  const mature = new Color(plant.mature),
    spring = new Color(plant.spring),
    laurel = new Color("#658b53"),
    color = new Color();
  // Cylindrical UVs would squeeze an entire circumference through one pole.
  // Both ends get their own metre-scaled chart. The duplicated chart edges
  // share normals so that sunlight still sees one continuous surface.
  const capRings = Math.max(
    1,
    Math.round(Math.min((size.width * 0.36) / size.length, 0.3) * columns),
  );
  const cuts = [0, capRings, columns - capRings, columns];
  const seams: number[] = [];
  for (let chart = 0; chart < 3; chart++) {
    const start = cuts[chart],
      end = cuts[chart + 1],
      cap = chart !== 1;
    if (chart) seams.push(positions.length / 3);
    for (let column = start; column <= end; column++) {
      const x = size.length * (column / columns - 0.5);
      let arc = 0;
      for (let ring = 0; ring <= sides; ring++) {
        const angle = (ring / sides - 0.5) * Math.PI * 2;
        canopyPoint(style, size, x, angle, point);
        if (ring) arc += previous.distanceTo(point);
        previous.copy(point);
        positions.push(point.x, point.y, point.z);
        const level = point.y / size.height;
        const growth = 0.5 + 0.3 * Math.sin(x * 4 + angle) + 0.2 * Math.cos(x * 9.3 - angle * 1.7);
        color
          .copy(mature)
          .lerp(
            style === "mixed" && !oleanderAt(x) ? laurel : spring,
            (0.1 + 0.7 * level) * (0.5 + growth * 0.5),
          );
        color.multiplyScalar(0.72 + 0.28 * level);
        colors.push(color.r, color.g, color.b);
        if (cap) uvs.push(point.z / plant.tile, point.y / plant.tile);
        else uvs.push((x + 0.047 * Math.sin(angle * 2.4 + x * 2)) / plant.tile, arc / plant.tile);
        if (column < end && ring < sides) {
          const a = positions.length / 3 - 1;
          const next = a + sides + 1;
          indices.push(a, a + 1, next, next, a + 1, next + 1);
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  for (const seam of seams) {
    for (let ring = 0; ring <= sides; ring++) {
      const after = seam + ring,
        before = after - sides - 1;
      point
        .fromBufferAttribute(normals, before)
        .add(previous.fromBufferAttribute(normals, after))
        .normalize();
      normals.setXYZ(before, point.x, point.y, point.z);
      normals.setXYZ(after, point.x, point.y, point.z);
    }
  }
  geometry.computeBoundingSphere();
  return geometry;
}
