import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Vector3 } from "three";
import { finish } from "./vegetation/geometry";

const shade = new Color("#4f7148");
const sun = new Color("#82a06b");

function ovalLeaf(start: Vector3, axis: Vector3, halfWidth: number, color: Color) {
  const across = new Vector3(-axis.z, 0, axis.x).normalize();
  const positions: number[] = [],
    colors: number[] = [];
  // The asymmetric shoulder and softly folded blade leave a distinct midrib in the light.
  for (const [t, w, lift] of [
    [0, 0, 0],
    [0.29, -0.78, 0.018],
    [0.67, -1, 0.022],
    [1, 0, 0],
    [0.7, 0.94, 0.022],
    [0.34, 0.84, 0.018],
    [0.54, 0, 0.041],
  ]) {
    const point = start
      .clone()
      .addScaledVector(axis, t)
      .addScaledVector(across, w * halfWidth);
    point.y += lift;
    positions.push(...point.toArray());
    colors.push(...color.toArray());
  }
  const blade = new BufferGeometry();
  blade.setAttribute("position", new Float32BufferAttribute(positions, 3));
  blade.setAttribute("color", new Float32BufferAttribute(colors, 3));
  blade.setIndex([0, 6, 1, 1, 6, 2, 2, 6, 3, 3, 6, 4, 4, 6, 5, 5, 6, 0]);
  blade.computeVertexNormals();
  return blade;
}

/** Arching shoots open from the base; every visible blade grows from a leaf node. */
export function createShrubSprays() {
  const stems: BufferGeometry[] = [],
    leaves: BufferGeometry[] = [];
  for (let shoot = 0; shoot < 18; shoot++) {
    const angle = shoot * 2.399963;
    const ring = Math.sqrt((shoot + 0.55) / 18);
    const radial = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    const across = new Vector3(-radial.z, 0, radial.x);
    const reach = 0.55 * ring,
      height = 0.79 - 0.39 * ring ** 2 + 0.045 * Math.sin(shoot * 4);
    const alongStem = (t: number) => {
      const p = radial
        .clone()
        .multiplyScalar(0.048 + reach * t ** 1.6)
        .addScaledVector(across, 0.065 * Math.sin(t * 2.1 + shoot) * t);
      p.y = height * t + 0.06 * Math.sin(t * Math.PI);
      return p;
    };
    const stem = new CylinderGeometry(0.003, 0.016, 1, 4, 3, true);
    const pos = stem.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const center = alongStem(pos.getY(i) + 0.5);
      pos.setXYZ(i, center.x + pos.getX(i), center.y, center.z + pos.getZ(i));
    }
    stem.computeVertexNormals();
    stems.push(stem);
    for (let pair = 0; pair < 4; pair++) {
      const node = 0.32 + pair * 0.18;
      for (const side of [-1, 1]) {
        const start = alongStem(node + (side + 1) * 0.013);
        const axis = radial
          .clone()
          .multiplyScalar(0.09 + 0.025 * pair)
          .addScaledVector(across, side * (0.16 - 0.015 * pair));
        axis.y = 0.018 + 0.034 * pair + 0.024 * Math.sin(shoot + side);
        const tone = shade.clone().lerp(sun, 0.16 + 0.12 * pair + 0.09 * Math.sin(shoot * 2.1));
        leaves.push(ovalLeaf(start, axis, 0.073 - 0.004 * pair, tone));
      }
    }
    const terminal = radial.clone().multiplyScalar(0.15);
    terminal.y = 0.15;
    leaves.push(ovalLeaf(alongStem(1), terminal, 0.047, sun));
  }
  return finish(stems, leaves, [1.35, 0.92, 1.15]);
}
