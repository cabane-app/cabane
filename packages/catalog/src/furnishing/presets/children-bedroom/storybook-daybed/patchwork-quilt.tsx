import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute } from "three";
import { ToonMaterial } from "@cabane/engine";
import { linenWeaveTexture } from "../../construction/linen-weave-texture";

// A pieced eight-point star is sewn into each of three wide bands.
// Split the half-square triangles at their true seams so their edges stay crisp.
function quilt() {
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = [];
  const across = 8,
    along = 12;
  const cream = new Color("#fff1d8"),
    rose = new Color("#bc7982"),
    apricot = new Color("#dfad87"),
    leaf = new Color("#9bad98");
  const accent = [rose, leaf, apricot];
  function vertex(u: number, v: number, tone: Color, lift = 0) {
    const span = 2 * u - 1;
    const edge = Math.abs(span);
    const drop = Math.max(0, (edge - 0.8) / 0.2);
    const x = -0.0055 + span * 0.5915;
    const z = -0.43 + 1.55 * v + 0.012 * Math.sin(span * Math.PI) * Math.cos(v * Math.PI);
    const puff =
      0.013 * Math.sin(((u * across) % 1) * Math.PI) * Math.sin(((v * along) % 1) * Math.PI);
    const y =
      0.438 - 0.009 * edge * edge - 0.135 * drop ** 1.5 + puff + 0.004 * Math.sin(z * 8 + span * 3);
    positions.push(x, y + lift, z);
    colors.push(tone.r, tone.g, tone.b);
    uvs.push(x * 4, z * 4);
  }
  for (let j = 0; j < along; j++) {
    for (let i = 0; i < across; i++) {
      const x = i % 4,
        y = j % 4,
        band = Math.floor(j / 4);
      const ink = accent[(Math.floor(i / 4) + band) % 3];
      const centerX = x === 1 || x === 2,
        centerY = y === 1 || y === 2;
      const corners = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ];
      for (let edge = 0; edge < 4; edge++) {
        const corner = corners[edge],
          next = corners[(edge + 1) % 4];
        const towardCore = centerX ? (x === 1 ? 1 : 3) : y === 1 ? 2 : 0;
        const inward = centerX ? (y === 0 ? 2 : 0) : x === 0 ? 1 : 3;
        const star =
          (centerX && centerY) ||
          ((centerX || centerY) && (edge === towardCore || edge === inward));
        const tone = star ? ink : cream;
        vertex(corner[0] / across, corner[1] / along, tone);
        vertex((i + 0.5) / across, (j + 0.5) / along, tone);
        vertex(next[0] / across, next[1] / along, tone);
      }
    }
  }
  // The turned-back lining rolls over the first seam and rests on the fitted sheet.
  const lining = new Color("#ecd3af");
  const cuff = [
    [-0.07, -0.016],
    [-0.066, 0.001],
    [-0.022, 0.014],
    [0, 0],
  ];
  for (let i = 0; i < across * 2; i++) {
    const left = i / (across * 2),
      right = (i + 1) / (across * 2);
    for (let j = 1; j < cuff.length; j++) {
      const [start, startLift] = cuff[j - 1],
        [end, endLift] = cuff[j];
      vertex(left, start, lining, startLift);
      vertex(left, end, lining, endLift);
      vertex(right, start, lining, startLift);
      vertex(right, start, lining, startLift);
      vertex(left, end, lining, endLift);
      vertex(right, end, lining, endLift);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}
const cover = quilt();
export function PatchworkQuilt() {
  return (
    <mesh name="pieced-star-coverlet" geometry={cover} castShadow receiveShadow>
      <ToonMaterial color="#ffffff" vertexColors side={DoubleSide} map={linenWeaveTexture} />
    </mesh>
  );
}
