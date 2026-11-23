import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from "three";
import { gardenRandom } from "./garden-layout";

type Cover = "ferns" | "rosettes" | "sedges" | "grasses" | "litter";
const tau = Math.PI * 2;

export function groundcoverSpecimen(kind: Cover) {
  const random = gardenRandom(1029),
    positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const vertex = (p: Vector3, color: Color) => {
    positions.push(p.x, p.y, p.z);
    colors.push(color.r, color.g, color.b);
    return positions.length / 3 - 1;
  };
  const leaf = (root: Vector3, tip: Vector3, halfWidth: number, tint: Color) => {
    const mid = root.clone().lerp(tip, 0.48),
      delta = tip.clone().sub(root);
    const side = new Vector3(-delta.z, 0, delta.x).normalize().multiplyScalar(halfWidth);
    const a = vertex(root, tint.clone().multiplyScalar(0.69)),
      b = vertex(mid.clone().sub(side), tint);
    const c = vertex(
      mid.clone().add(new Vector3(0, halfWidth * 0.27, 0)),
      tint.clone().multiplyScalar(1.09),
    );
    const d = vertex(mid.add(side), tint),
      e = vertex(tip, tint);
    indices.push(a, b, c, a, c, d, b, e, c, c, e, d);
  };
  const frond = new Color("#536d3c"),
    blade = new Color("#586b3f"),
    straw = new Color("#93885b");
  if (kind === "ferns") {
    for (let i = 0; i < 8; i++) {
      const yaw = i * 2.39996 + random() * 0.55,
        wide = 0.27 + random() * 0.4,
        height = 0.2 + random() * 0.26;
      const dx = Math.cos(yaw),
        dz = Math.sin(yaw);
      const along = (t: number) =>
        new Vector3(dx * wide * t, 0.018 + height * (Math.sin(t * 2.45) + 0.16 * t), dz * wide * t);
      const tint = frond.clone().lerp(new Color("#81944c"), random() * 0.46);
      for (let j = 0; j < 11; j++) {
        const t = j / 11,
          root = along(t);
        leaf(root, along((j + 1) / 11), 0.006, tint);
        if (j < 2) continue;
        const reach = Math.sin(Math.PI * (t - 0.05)) * 0.135 * (0.8 + random() * 0.3);
        for (const side of [-1, 1]) {
          const end = root
            .clone()
            .add(
              new Vector3(
                dx * 0.05 - dz * reach * side,
                0.012 + reach * 0.12,
                dz * 0.05 + dx * reach * side,
              ),
            );
          leaf(root, end, 0.015 + reach * 0.092, tint);
        }
      }
    }
  } else if (kind === "rosettes") {
    // Curved, ribbed basal leaves in small colonies underneath the canopy.
    for (let k = 0; k < 4; k++) {
      const ox = (random() - 0.5) * 0.8,
        oz = (random() - 0.5) * 0.8;
      for (let i = 0; i < 6; i++) {
        const a = i * 2.39996 + random() * 0.4,
          dx = Math.cos(a),
          dz = Math.sin(a);
        const length = 0.12 + random() * 0.19,
          width = length * (0.2 + random() * 0.11);
        const tint = new Color("#637840").lerp(new Color("#889151"), random() * 0.52);
        let last = 0;
        for (let j = 0; j <= 5; j++) {
          const t = j / 5,
            span = width * Math.pow(Math.sin(t * Math.PI), 0.69);
          const x = ox + dx * length * t,
            z = oz + dz * length * t;
          const y = 0.016 + length * (Math.sin(t * 2.3) * 0.54 + 0.18 * t);
          const idx = vertex(
            new Vector3(x - dz * span, y + span * 0.18, z + dx * span),
            tint.clone().multiplyScalar(0.65 + 0.23 * t),
          );
          vertex(new Vector3(x, y + span * 0.14, z), tint.clone().multiplyScalar(0.91 + 0.18 * t));
          vertex(
            new Vector3(x + dz * span, y - span * 0.09, z - dx * span),
            tint.clone().multiplyScalar(0.72 + 0.2 * t),
          );
          if (j)
            indices.push(
              last,
              idx,
              last + 1,
              idx,
              idx + 1,
              last + 1,
              last + 1,
              idx + 1,
              last + 2,
              idx + 1,
              idx + 2,
              last + 2,
            );
          last = idx;
        }
      }
    }
  } else if (kind === "grasses") {
    for (let i = 0; i < 17; i++) {
      const angle = random() * tau,
        dx = Math.cos(angle),
        dz = Math.sin(angle),
        r = Math.sqrt(random()) * 0.27;
      const root = new Vector3(dx * r, -0.014, dz * r),
        h = 0.065 + random() * 0.16;
      const elbow = root.clone().add(new Vector3(dx * h * 0.28, h * 0.72, dz * h * 0.28));
      const tip = elbow.clone().add(new Vector3(dx * h * 0.52, h * 0.28, dz * h * 0.52));
      const tint = new Color("#596d41").lerp(new Color("#9c976e"), random() * 0.62),
        w = 0.0034 + random() * 0.0038;
      const a = vertex(
        root.clone().add(new Vector3(-dz * w, 0, dx * w)),
        tint.clone().multiplyScalar(0.82),
      );
      const b = vertex(
        root.clone().add(new Vector3(dz * w, 0, -dx * w)),
        tint.clone().multiplyScalar(0.86),
      );
      const c = vertex(elbow.clone().add(new Vector3(-dz * w * 0.55, 0, dx * w * 0.55)), tint);
      const d = vertex(elbow.clone().add(new Vector3(dz * w * 0.55, 0, -dx * w * 0.55)), tint);
      const e = vertex(tip, tint.clone().multiplyScalar(1.06));
      indices.push(a, b, c, b, d, c, c, d, e);
    }
  } else if (kind === "sedges") {
    for (let i = 0; i < 36; i++) {
      const yaw = random() * tau,
        dx = Math.cos(yaw),
        dz = Math.sin(yaw);
      const t = Math.sqrt(random()),
        height = 0.14 + (0.58 - 0.22 * t) * random(),
        bend = 0.05 + 0.22 * t;
      const root = new Vector3(dx * 0.095 * t, 0, dz * 0.095 * t);
      const tint = blade.clone().lerp(straw, 0.2 + random() * 0.6);
      let lastL = 0,
        lastR = 0;
      for (let k = 0; k <= 3; k++) {
        const v = k / 3;
        const mid = root
          .clone()
          .add(new Vector3(dx * bend * v * v, height * (v - 0.22 * v * v), dz * bend * v * v));
        const w = (1 - v * 0.98) * (0.006 + 0.0045 * t);
        const l = vertex(
          mid.clone().add(new Vector3(-dz * w, 0, dx * w)),
          tint.clone().multiplyScalar(0.58 + v * 0.52),
        );
        const r = vertex(mid.clone().add(new Vector3(dz * w, 0, -dx * w)), tint);
        if (k) indices.push(lastL, l, lastR, lastR, l, r);
        lastL = l;
        lastR = r;
      }
    }
  } else {
    for (let i = 0; i < 23; i++) {
      const yaw = random() * tau,
        r = 0.52 * Math.sqrt(random()),
        dir = random() * tau;
      const root = new Vector3(r * Math.cos(yaw), 0.012 + random() * 0.013, r * Math.sin(yaw));
      const length = 0.04 + random() * 0.07;
      const tip = root
        .clone()
        .add(new Vector3(Math.cos(dir) * length, 0.01, Math.sin(dir) * length));
      leaf(root, tip, length * 0.24, new Color("#77634a").lerp(new Color("#a78c60"), random()));
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function fieldstone() {
  const geo = new IcosahedronGeometry(1, 2),
    points = geo.getAttribute("position");
  const colors: number[] = [],
    clay = new Color("#878377"),
    mineral = new Color("#a5a497");
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i),
      y = points.getY(i),
      z = points.getZ(i);
    const wear = 0.95 + 0.09 * Math.sin(4 * x + 3 * y) * Math.cos(5 * z - y);
    points.setXYZ(i, (0.52 * x + 0.09 * y) * wear, 0.3 * y * wear + 0.11, 0.41 * z * wear);
    const tone = clay.clone().lerp(mineral, 0.44 + 0.31 * Math.sin(x * 13 + y * 18 + z * 7));
    tone.multiplyScalar(0.88 + 0.12 * y);
    colors.push(tone.r, tone.g, tone.b);
  }
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
