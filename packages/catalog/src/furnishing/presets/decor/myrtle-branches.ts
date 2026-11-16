import {
  Box3,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const up = new Vector3(0, 1, 0);
function stem(base: Vector3, tip: Vector3, radius: number) {
  const delta = tip.clone().sub(base);
  const branch = new CylinderGeometry(radius * 0.5, radius, delta.length(), 6);
  branch.applyQuaternion(new Quaternion().setFromUnitVectors(up, delta.normalize()));
  const middle = base.clone().lerp(tip, 0.5);
  return branch.translate(middle.x, middle.y, middle.z);
}

// Each opposite pair grows from a common twig node. The midrib stands proud of
// the margins, which bend down just before the tip of each lanceolate leaf.
function appendLeaf(
  vertices: number[],
  base: Vector3,
  angle: number,
  length: number,
  lift: number,
) {
  const along = new Vector3(Math.cos(angle), lift, Math.sin(angle))
    .normalize()
    .multiplyScalar(length);
  const width = new Vector3(-Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(length * 0.18);
  const center = base.clone().addScaledVector(along, 0.5);
  const ridge = center.clone();
  ridge.y += length * 0.11;
  const left = center.clone().sub(width),
    right = center.clone().add(width),
    tip = base.clone().add(along);
  tip.y -= length * 0.08;
  for (const p of [base, ridge, left, base, right, ridge, left, ridge, tip, ridge, right, tip])
    vertices.push(p.x, p.y, p.z);
}
function growMyrtle() {
  const blades: number[][] = [[], [], []],
    wood: CylinderGeometry[] = [];
  const root = new Vector3(0, 0.37, 0),
    fork = new Vector3(0.013, 0.68, -0.008);
  wood.push(stem(root, fork, 0.029));
  for (let b = 0; b < 42; b++) {
    const angle = b * 2.399963,
      level = (b + 0.5) / 42;
    const spread = 0.255 * Math.sqrt(1 - (2 * level - 1) ** 2);
    const node = new Vector3(
      spread * Math.cos(angle),
      0.73 + 0.4 * level,
      spread * Math.sin(angle),
    );
    const joint = root.clone().lerp(fork, 0.56 + 0.44 * level);
    wood.push(stem(joint, node, 0.0095));
    for (let fan = -1; fan <= 1; fan++) {
      const azimuth = angle + fan * 0.77;
      const tip = node
        .clone()
        .add(
          new Vector3(0.079 * Math.cos(azimuth), 0.05 + level * 0.038, 0.079 * Math.sin(azimuth)),
        );
      wood.push(stem(node, tip, 0.004));
      for (let pair = 0; pair < 5; pair++) {
        const at = node.clone().lerp(tip, pair / 4);
        for (const side of [-1, 1]) {
          const direction = azimuth + side * (0.51 + 0.37 * (pair % 2));
          appendLeaf(
            blades[(b + pair + fan + 1) % 3],
            at,
            direction,
            0.079 + 0.023 * Math.sin(b + pair * 1.91),
            0.04 + 0.42 * Math.cos(b * 2.3 + pair),
          );
        }
      }
    }
  }
  const leaves = blades.map((points) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return geometry;
  });
  const branches = mergeGeometries(wood);
  wood.forEach((part) => part.dispose());
  const box = new Box3();
  leaves.forEach((g) => box.union(g.boundingBox!));
  const center = box.getCenter(new Vector3()),
    size = box.getSize(new Vector3());
  const fit = new Matrix4()
    .makeScale(0.8 / size.x, (1.25 - root.y) / (box.max.y - root.y), 0.8 / size.z)
    .multiply(new Matrix4().makeTranslation(-center.x, -root.y, -center.z));
  for (const geometry of [...leaves, branches]) {
    geometry.applyMatrix4(fit);
    geometry.translate(0, root.y, 0);
  }
  return { leaves, branches };
}
let sharedMyrtle: ReturnType<typeof growMyrtle> | undefined;

export function getMyrtleBranches() {
  return (sharedMyrtle ??= growMyrtle());
}
