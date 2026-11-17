import { Box3, BufferGeometry, Color, Float32BufferAttribute, Matrix4, Vector3 } from "three";

const mature = ["#395632", "#49643b", "#405e3b", "#526a3e", "#4b6547"].map((hex) => new Color(hex));
const young = ["#728b54", "#85985e", "#6b8550"].map((hex) => new Color(hex));
const bark = new Color("#68573c");
const twig = new Color("#6f734b");

export type IvyBlade = { matrix: Matrix4; color: Color };

export function ivyGrowth(length: number, height: number, width: number) {
  // Keep the plants stable through camera moves and edits to neighboring borders.
  let seed = 8675309;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const leafSize = Math.min(0.165, length * 0.43, height * 0.29, width * 0.55);
  const wallHeight = height - leafSize * 0.43;
  const wallSide = width * 0.22;
  const skin = Math.min(width * 0.18, 0.08);
  const minX = -length / 2 + leafSize * 0.57,
    maxX = -minX;
  const plants = Math.max(1, Math.min(32, Math.ceil(length / 1.08)));
  const spacing = length / plants;
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const leaves: IvyBlade[] = [],
    tips: IvyBlade[] = [];
  // Combined bounds of the cupped atlas and opaque silhouettes, including the
  // curl at the juvenile tip. Both must respect the same path clearance.
  const bladeBounds = new Box3(
    new Vector3(-0.571, -0.111, -0.188),
    new Vector3(0.571, 1.011, 0.094),
  );
  const transformed = new Box3();

  function stem(path: Vector3[], radius: number, color: Color) {
    const first = positions.length / 3;
    for (let i = 0; i < path.length; i++) {
      const at = path[i],
        tangent = new Vector3()
          .subVectors(path[Math.min(i + 1, path.length - 1)], path[Math.max(i - 1, 0)])
          .normalize();
      const u = new Vector3(0, 0, 1).cross(tangent);
      if (u.lengthSq() < 0.0001) u.set(1, 0, 0);
      u.normalize();
      const v = new Vector3().crossVectors(tangent, u);
      const r = radius * (1 - (0.77 * i) / (path.length - 1));
      for (let face = 0; face < 4; face++) {
        const cross = at
          .clone()
          .addScaledVector(u, [r, 0, -r, 0][face])
          .addScaledVector(v, [0, r, 0, -r][face]);
        positions.push(
          clamp(cross.x, -length / 2, length / 2),
          clamp(cross.y, 0, height),
          clamp(cross.z, -width / 2, width / 2),
        );
        colors.push(color.r, color.g, color.b);
        if (i) {
          const a = first + (i - 1) * 4 + face,
            b = first + (i - 1) * 4 + ((face + 1) % 4);
          indices.push(a, b, b + 4, a, b + 4, a + 4);
        }
      }
    }
  }

  function leaf(at: Vector3, side: number, hand: number, isYoung: boolean, overCap = false) {
    const size = leafSize * (0.64 + random() * 0.46) * (isYoung ? 0.64 : 1);
    const angle = hand * (1.03 + 1.95 * random());
    const away = 0.18 + random() * 0.63;
    const blade = overCap
      ? new Vector3(Math.cos(angle), 0.12, side * Math.sin(angle)).normalize()
      : new Vector3(Math.sin(angle), Math.cos(angle), side * away).normalize();
    const across = (
      overCap ? new Vector3(-blade.z, 0, blade.x) : new Vector3(side * blade.y, -side * blade.x, 0)
    )
      .normalize()
      .applyAxisAngle(blade, (random() - 0.5) * 0.72);
    const normal = new Vector3().crossVectors(across, blade);
    const matrix = new Matrix4()
      .makeBasis(across, blade, normal)
      .scale(new Vector3(size * (0.8 + 0.37 * random()), size, size));
    transformed.copy(bladeBounds).applyMatrix4(matrix);
    matrix.setPosition(
      clamp(at.x, -length / 2 - transformed.min.x, length / 2 - transformed.max.x),
      clamp(at.y, -transformed.min.y, height - transformed.max.y),
      clamp(at.z, -width / 2 - transformed.min.z, width / 2 - transformed.max.z),
    );
    const palette = isYoung ? young : mature;
    (isYoung ? tips : leaves).push({
      matrix,
      color: palette[Math.floor(random() * palette.length)]!,
    });
  }

  for (const side of [-1, 1])
    for (let colony = 0; colony < plants; colony++) {
      const lush = random() < 0.52;
      const centerX = -length / 2 + (colony + 0.24 + random() * 0.51) * spacing;
      const phase = random() * Math.PI * 2;
      const reachesCap = (colony + side + 1) % 3 === 0 || random() < 0.24;
      const reach = wallHeight * (reachesCap ? 1 : 0.56 + random() * 0.42);
      const drift = (random() - 0.5) * Math.min(spacing, 1.2);
      const steps = Math.max(4, Math.min(35, Math.ceil(reach / 0.09)));
      const stalk: Vector3[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x =
          centerX +
          drift * t +
          Math.sin(t * 5.4 + phase) * Math.min(spacing * 0.14, 0.15) +
          Math.sin(t * 11 + phase) * 0.035;
        const at = new Vector3(
          clamp(x, minX, maxX),
          reach * t,
          side * (wallSide + skin * (0.25 + 0.15 * Math.sin(phase + t * 5))),
        );
        stalk.push(at);
        if (i > 1) leaf(at, side, i % 2 ? 1 : -1, t > 0.86);
      }
      stem(stalk, Math.min(0.012, width * 0.045), bark);
      const shoots = Math.max(2, Math.min(8, Math.ceil(reach / 0.21)));
      for (let j = 0; j < shoots; j++) {
        const hand = j % 2 ? -1 : 1;
        const start =
          stalk[Math.min(steps - 1, Math.floor((steps * (j + 0.42 + random() * 0.38)) / shoots))]!;
        const span = Math.min(spacing * 0.66, 0.68) * (0.71 + random() * 0.46);
        const rise = Math.min(height * 0.31, 0.48) * (random() * 1.35 - 0.27);
        const count = Math.max(3, Math.min(11, Math.ceil(Math.hypot(span, rise) / 0.065)));
        const path = [start];
        for (let k = 1; k <= count; k++) {
          const t = k / count;
          const x = clamp(start.x + hand * span * t, minX, maxX);
          const y = clamp(
            start.y + rise * t + Math.sin(t * Math.PI) * Math.min(0.095, height * 0.08),
            0.035,
            wallHeight - 0.018,
          );
          const z =
            side *
            (wallSide +
              skin * (0.34 + 0.46 * Math.sin(t * Math.PI) + 0.15 * Math.sin(phase + j + t * 2.4)));
          const at = new Vector3(x, y, z);
          path.push(at);
          leaf(at, side, k % 2 ? hand : -hand, k >= count - 1 && random() < 0.65);
        }
        stem(
          path.filter((_, k) => k % 2 === 0 || k === count),
          Math.min(0.0045, width * 0.017),
          twig,
        );
        // Dense colonies send short secondary shoots into the gaps between leaders.
        if (lush && j % 3 !== 0) {
          const fork = path[Math.floor(count * (0.4 + 0.37 * random()))]!;
          const lateral = [fork];
          const lift = (0.14 + random() * 0.14) * (j % 2 ? 1 : -1);
          for (let k = 1; k <= 4; k++) {
            const t = k / 4;
            const at = new Vector3(
              clamp(fork.x + hand * span * 0.42 * t, minX, maxX),
              clamp(fork.y + lift * t, 0.04, wallHeight),
              fork.z + side * skin * 0.24 * Math.sin(t * Math.PI),
            );
            lateral.push(at);
            leaf(at, side, k % 2 ? hand : -hand, k === 4);
          }
          stem([lateral[0]!, lateral[2]!, lateral[4]!], Math.min(0.0035, width * 0.013), twig);
        }
      }
      if (reachesCap) {
        const start = stalk[steps]!;
        const across = new Vector3(
          clamp(start.x + Math.sin(phase) * 0.13, minX, maxX),
          wallHeight + leafSize * 0.14,
          -side * (wallSide + skin * 0.4),
        );
        const cape = [
          start,
          new Vector3((start.x + across.x) / 2, wallHeight + leafSize * 0.23, 0),
          across,
        ];
        for (let k = 1; k <= 3; k++) {
          const top = cape[0]!.clone().lerp(across, k / 4);
          top.y = wallHeight + leafSize * 0.17;
          leaf(top, side, k % 2 ? 1 : -1, k === 2, true);
        }
        const fall = Math.min(reach * 0.63, 0.55) * (0.46 + random() * 0.54);
        const count = Math.max(2, Math.ceil(fall / 0.065));
        for (let k = 1; k <= count; k++) {
          const t = k / count;
          const at = new Vector3(
            clamp(across.x + Math.sin(phase + t * 2.6) * t * 0.12, minX, maxX),
            across.y - t * fall,
            across.z - side * skin * 0.38 * Math.sin(t * Math.PI),
          );
          cape.push(at);
          leaf(at, -side, k % 2 ? 1 : -1, k === count);
        }
        stem(cape, Math.min(0.006, width * 0.025), twig);
      }
    }
  const stems = new BufferGeometry();
  stems.setAttribute("position", new Float32BufferAttribute(positions, 3));
  stems.setAttribute("color", new Float32BufferAttribute(colors, 3));
  stems.setIndex(indices);
  stems.computeVertexNormals();
  return { stems, leaves, tips, wallHeight, wallSide };
}
