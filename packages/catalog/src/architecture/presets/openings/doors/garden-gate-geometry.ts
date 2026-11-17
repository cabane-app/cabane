import type { GardenGateVariant } from "@cabane/engine";
import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Shape } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Point = readonly [number, number];

function prism(outline: readonly Point[], depth: number, bevel = 0) {
  const shape = new Shape();
  outline.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return new ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelSegments: 1,
    bevelThickness: bevel,
    bevelSize: bevel,
  }).translate(0, 0, -depth / 2 + bevel);
}

function merged(parts: BufferGeometry[]) {
  const triangles = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const result = mergeGeometries(triangles);
  for (const part of new Set([...parts, ...triangles])) part.dispose();
  result.userData.preservePlanarFaces = true;
  return result;
}

/** Each board is cut from its own length of timber; keep grain along that stock after rotation. */
function timber(board: BufferGeometry, offset: number) {
  const uv = board.getAttribute("uv"),
    p = board.getAttribute("position"),
    n = board.getAttribute("normal");
  for (let i = 0; i < p.count; i++)
    uv.setXY(
      i,
      (Math.abs(n.getX(i)) > 0.8 ? p.getZ(i) : p.getX(i)) / 0.66 + offset,
      p.getY(i) / 1.65 + offset * 0.4,
    );
  return board;
}

function timberGate(width: number, height: number, hand: number) {
  const count = Math.max(3, Math.round(width / 0.095)),
    pitch = width / count;
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const half = pitch * 0.445,
      dogEar = Math.min(0.016, half * 0.42, height * 0.08),
      bevel = Math.min(0.0012, half * 0.07);
    const top = height / 2 - bevel,
      bottom = -height / 2 + bevel;
    const picket = prism(
      [
        [-half, bottom],
        [half, bottom],
        [half, top - dogEar],
        [half - dogEar, top],
        [-half + dogEar, top],
        [-half, top - dogEar],
      ],
      0.028,
      bevel,
    );
    parts.push(timber(picket, i * 0.347).translate((i + 0.5) * pitch - width / 2, 0, 0.006));
  }
  const rail = Math.min(0.062, width * 0.12, height * 0.11),
    railY = height * 0.32;
  for (const s of [-1, 1]) {
    const ledge = timber(new BoxGeometry(rail, width, 0.026), s * 0.275).rotateZ(Math.PI / 2);
    parts.push(ledge.translate(0, s * railY, -0.021));
  }
  const run = Math.max(0, width - rail * 2),
    rise = 2 * railY - rail;
  const brace = timber(new BoxGeometry(rail * 0.8, Math.hypot(run, rise), 0.024), 0.6);
  parts.push(brace.rotateZ(-hand * Math.atan2(run, rise)).translate(0, 0, -0.021));
  return parts;
}

function metalGate(variant: GardenGateVariant, width: number, height: number) {
  const rail = Math.min(0.042, width / 6, height / 6);
  const w = width - 2 * rail,
    h = height - 2 * rail;
  const parts: BufferGeometry[] = [];
  // A pair of folded faces meets each stile. Keep the perimeter clear of the posts.
  for (const side of [-1, 1]) {
    parts.push(new BoxGeometry(rail, height, 0.052).translate((side * (width - rail)) / 2, 0, 0));
    parts.push(new BoxGeometry(w, rail, 0.052).translate(0, (side * (height - rail)) / 2, 0));
  }
  if (variant === "garden-anthracite") {
    const count = Math.max(2, Math.round(h / 0.11)),
      pitch = h / count;
    for (let i = 0; i < count; i++) {
      const half = pitch * 0.5,
        lip = Math.min(0.009, pitch * 0.15);
      // Profile through one folded aluminium board; its recessed interlock catches grazing light.
      const outline: Point[] = [
        [-0.013, -half],
        [0.008, -half],
        [0.008, -half + lip],
        [0.018, -half + 2 * lip],
        [0.018, half - lip],
        [0.011, half],
        [0.003, half],
        [-0.014, half - lip],
        [-0.014, -half + lip],
      ];
      parts.push(
        prism(outline, w)
          .rotateY(Math.PI / 2)
          .translate(0, (i + 0.5) * pitch - h / 2, 0),
      );
    }
  } else {
    const count = Math.max(1, Math.round(w / 0.095)),
      pitch = w / (count + 1);
    for (let i = 1; i <= count; i++) {
      const x = i * pitch - w / 2,
        radius = Math.min(0.012, pitch * 0.28);
      parts.push(
        new CylinderGeometry(radius, radius, h, 4).rotateY(Math.PI / 4).translate(x, 0, 0),
      );
      for (const side of [-1, 1]) {
        const collar = new CylinderGeometry(
          radius,
          radius * 1.48,
          Math.min(0.029, h * 0.065),
          4,
        ).rotateY(Math.PI / 4);
        parts.push(collar.rotateZ(side === 1 ? 0 : Math.PI).translate(x, side * h * 0.31, 0));
      }
    }
    for (const side of [-1, 1])
      parts.push(
        new BoxGeometry(w, Math.min(0.022, h * 0.07), 0.023).translate(0, side * h * 0.28, -0.002),
      );
  }
  return parts;
}

export function gardenGateBody(
  variant: GardenGateVariant,
  width: number,
  height: number,
  hand: number,
) {
  return merged(
    variant === "garden-wood" ? timberGate(width, height, hand) : metalGate(variant, width, height),
  );
}

export function gardenGateIronwork(
  variant: GardenGateVariant,
  width: number,
  height: number,
  hand: number,
) {
  const parts: BufferGeometry[] = [];
  const plateWidth = Math.min(0.038, width * 0.16),
    plateHeight = Math.min(0.11, height * 0.25);
  const x = hand * (width / 2 - plateWidth * 0.72),
    y = height * 0.18;
  const lever = Math.min(0.095, width * 0.32),
    radius = Math.min(0.007, plateWidth * 0.19);
  for (const face of [-1, 1]) {
    const faceDepth = variant === "garden-wood" ? (face > 0 ? 0.02 : 0.008) : 0.026;
    parts.push(
      new BoxGeometry(plateWidth, plateHeight, 0.006).translate(x, y, face * (faceDepth + 0.003)),
    );
    const spindle = new CylinderGeometry(radius * 1.55, radius * 1.55, 0.014, 12).rotateX(
      Math.PI / 2,
    );
    parts.push(spindle.translate(x, y + plateHeight * 0.17, face * (faceDepth + 0.013)));
    parts.push(
      new CylinderGeometry(radius, radius, lever, 10)
        .rotateZ(Math.PI / 2)
        .translate(x - hand * lever * 0.45, y + plateHeight * 0.17, face * (faceDepth + 0.021)),
    );
    const button = new CylinderGeometry(radius * 1.12, radius * 1.12, 0.003, 10).rotateX(
      Math.PI / 2,
    );
    parts.push(button.translate(x, y - plateHeight * 0.25, face * (faceDepth + 0.0075)));
  }
  const strapZ = variant === "garden-wood" ? -0.036 : -0.028;
  const hingeX = -hand * (width / 2 - Math.min(0.017, width * 0.12));
  const strap = Math.min(variant === "garden-wood" ? 0.19 : 0.08, width * 0.34);
  for (const side of [-1, 1]) {
    const hingeY = side * height * 0.32;
    const barrelRadius = Math.min(0.009, width * 0.06),
      barrelHeight = Math.min(0.082, height * 0.2);
    parts.push(
      new CylinderGeometry(barrelRadius, barrelRadius, barrelHeight, 12).translate(
        hingeX,
        hingeY,
        strapZ,
      ),
    );
    const neck = Math.min(0.016, barrelHeight * 0.2);
    const strapShape = prism(
      [
        [0, -neck],
        [strap * 0.18, -neck],
        [strap, -neck * 0.4],
        [strap, neck * 0.4],
        [strap * 0.18, neck],
        [0, neck],
      ],
      0.004,
    );
    parts.push(strapShape.rotateY(hand === 1 ? 0 : Math.PI).translate(hingeX, hingeY, strapZ));
    for (const t of [0.25, 0.82])
      parts.push(
        new CylinderGeometry(neck * 0.31, neck * 0.31, 0.003, 6)
          .rotateX(Math.PI / 2)
          .translate(hingeX + hand * strap * t, hingeY, strapZ - 0.003),
      );
  }
  return merged(parts);
}
