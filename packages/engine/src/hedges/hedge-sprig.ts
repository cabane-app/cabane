import { BufferGeometry, Color, Float32BufferAttribute } from "three";

export type Shoot = "privet" | "hazel" | "laurel" | "oleander" | "blossom";

const blades = {
  privet: { width: 0.112, length: 0.34, tip: "#6c804b", shade: "#4e6840" },
  hazel: { width: 0.122, length: 0.45, tip: "#758950", shade: "#50683d" },
  laurel: { width: 0.118, length: 0.56, tip: "#628252", shade: "#426740" },
  oleander: { width: 0.046, length: 0.64, tip: "#6d8b65", shade: "#4a7050" },
};

/** One little branch, reused for the entire run. Each folded blade has a
 * raised midrib; its darker underside remains visible at the silhouette. */
export function hedgeSprigGeometry(species: Shoot) {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const color = new Color();
  function vertex(x: number, y: number, z: number, hex: string, light = 1) {
    color.set(hex).multiplyScalar(light);
    colors.push(color.r, color.g, color.b);
    positions.push(x, y, z);
    return positions.length / 3 - 1;
  }
  // Taper the stem to its growing tip.
  const stem = "#6a7047";
  vertex(-0.012, 0, -0.014, stem);
  vertex(0.012, 0, -0.014, stem);
  vertex(0.036, 0.94, 0.13, stem);
  indices.push(0, 1, 2);
  if (species === "blossom") {
    // Several five-lobed oleander corollas on one spray, clustered only on
    // the flowering growth. Each throat sits in its own folded petals.
    for (let flower = 0; flower < 4; flower++) {
      const x = [-0.16, 0.12, 0.23, -0.04][flower];
      const y = [0.7, 0.98, 0.62, 0.52][flower];
      const z = 0.14 + 0.028 * flower;
      const center = vertex(x, y, z, "#ce906f");
      for (let petal = 0; petal < 5; petal++) {
        const angle = petal * Math.PI * 0.4 + flower;
        const tint = flower % 2 ? "#dfa2ac" : "#c78595";
        const a = vertex(
          x + Math.cos(angle - 0.52) * 0.105,
          y + Math.sin(angle - 0.52) * 0.105,
          z + 0.045,
          tint,
        );
        const b = vertex(
          x + Math.cos(angle) * 0.142,
          y + Math.sin(angle) * 0.142,
          z + 0.063,
          tint,
          1.08,
        );
        const c = vertex(
          x + Math.cos(angle + 0.65) * 0.09,
          y + Math.sin(angle + 0.65) * 0.09,
          z + 0.035,
          tint,
        );
        indices.push(center, a, b, center, b, c);
      }
    }
  } else {
    const leaf = blades[species];
    for (let i = 0; i < 7; i++) {
      const pair = Math.floor(i / 2),
        side = i % 2 ? 1 : -1;
      const angle = i === 6 ? 0.13 : side * (1.06 - 0.13 * pair);
      const dx = Math.sin(angle),
        dy = Math.cos(angle);
      const y = i === 6 ? 0.8 : 0.16 + pair * 0.21 + (i % 2) * 0.045;
      const length = leaf.length * (1.1 - pair * 0.08),
        width = leaf.width * (1.1 - pair * 0.09);
      const z = y * 0.14,
        x = y * 0.035;
      const tint = i < 2 ? leaf.shade : leaf.tip;
      const blade = (along: number, across: number, curl: number, light: number) =>
        vertex(
          x + along * length * dx + across * width * dy,
          y + along * length * dy - across * width * dx,
          z + curl * width,
          tint,
          light,
        );
      const root = blade(0, 0, 0, 0.75);
      const left = blade(0.39, 1, 0.04, 0.86);
      const shoulder = blade(0.7, 0.76, 0.22, 0.9);
      const tip = blade(1, 0, -0.18, 1);
      const right = blade(0.49, -1, 0.06, 0.86);
      const ridge = blade(0.53, 0, 0.59, 1.1);
      indices.push(
        root,
        left,
        ridge,
        left,
        shoulder,
        ridge,
        shoulder,
        tip,
        ridge,
        tip,
        right,
        ridge,
        right,
        root,
        ridge,
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
