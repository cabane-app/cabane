import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from "three";
import { OLIVE_CROWN_LOBES } from "./olive-tree-structure";

const palette = ["#829365", "#9daa7e", "#b3be94"].map((hex) => new Color(hex));
const twig = new Color("#897e60");
const shoots = 13;

export function oliveShoot(
  center: readonly number[],
  radius: readonly number[],
  lobe: number,
  shoot: number,
) {
  const angle = shoot * 2.399963 + lobe * 0.71;
  const lift = -0.32 + (1.05 * (shoot + 0.5)) / shoots;
  const reach = Math.sqrt(1 - lift * lift);
  const origin = new Vector3(center[0], center[1], center[2]);
  const stem = new Vector3(
    Math.cos(angle) * reach * radius[0],
    lift * radius[1],
    Math.sin(angle) * reach * radius[2],
  );
  const across = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
  return { origin, stem, across };
}

/** Each silvery shoot forks into opposite, lance-shaped leaves. */
export function createOliveLeafSprays() {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const vertex = (p: Vector3, color: Color) => {
    positions.push(...p.toArray());
    colors.push(...color.toArray());
  };
  OLIVE_CROWN_LOBES.forEach(({ center, radius }, lobe) => {
    for (let shoot = 0; shoot < shoots; shoot++) {
      const { origin, stem, across } = oliveShoot(center, radius, lobe, shoot);
      const start = positions.length / 3;
      vertex(origin.clone().addScaledVector(across, -0.009), twig);
      vertex(origin.clone().addScaledVector(across, 0.009), twig);
      vertex(origin.clone().add(stem), twig);
      indices.push(start, start + 1, start + 2);
      for (let pair = 0; pair < 3; pair++) {
        const at = origin.clone().addScaledVector(stem, 0.37 + pair * 0.3);
        for (const sign of [-1, 1]) {
          const direction = stem
            .clone()
            .normalize()
            .multiplyScalar(0.84)
            .addScaledVector(across, sign * (0.8 - pair * 0.12))
            .normalize();
          const widthAxis = new Vector3(-direction.z, 0, direction.x).normalize();
          const length = 0.27 + 0.045 * Math.sin(shoot * 3 + lobe + pair);
          const mid = at.clone().addScaledVector(direction, length * 0.45);
          const hue = palette[(lobe + shoot + pair) % 3];
          const base = positions.length / 3;
          vertex(at, hue);
          vertex(mid.clone().addScaledVector(widthAxis, -length * 0.16), hue);
          const ridge = mid.clone();
          ridge.y += 0.025;
          vertex(ridge, hue);
          vertex(mid.clone().addScaledVector(widthAxis, length * 0.16), hue);
          const tip = at.clone().addScaledVector(direction, length);
          tip.y -= 0.02;
          vertex(tip, hue);
          indices.push(
            base,
            base + 2,
            base + 1,
            base,
            base + 3,
            base + 2,
            base + 1,
            base + 2,
            base + 4,
            base + 2,
            base + 3,
            base + 4,
          );
        }
      }
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
