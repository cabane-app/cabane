import { Scenery } from "./scenery";

const masonry = ["#a16350", "#ab7e63", "#845646", "#b79c7d", "#976c58", "#826853"];
const skyline = ["#899ba1", "#abb1ab", "#8e9596", "#a49a91", "#a6b3b6"];

function waterTower(s: Scenery, x: number, roof: number, z: number) {
  for (const dx of [-0.66, 0.66])
    for (const dz of [-0.66, 0.66])
      s.part("box", [x + dx, roof + 0.65, z + dz], [0.13, 1.4, 0.13], "#444749");
  s.part("cylinder", [x, roof + 2.4, z], [1.18, 2.15, 1.18], "#937252");
  for (const y of [1.55, 2.2, 3.12])
    s.part("cylinder", [x, roof + y, z], [1.2, 0.08, 1.2], "#555452");
  s.part("cone", [x, roof + 3.78, z], [1.36, 0.68, 1.36], "#536260");
}

export function newYork() {
  const s = new Scenery();
  s.part("box", [0, -0.27, 0], [580, 0.5, 580], "#646b70", 4);
  // A generous central block leaves room for the authored plot. Adjacent
  // buildings share party walls, while the avenues give long views downtown.
  for (let col = -4; col <= 4; col++) {
    for (let row = -4; row <= 4; row++) {
      const x = col * 32;
      const z = row * 27;
      const ring = Math.max(Math.abs(col), Math.abs(row));
      s.part("box", [x, 0.05, z], [26, 0.14, 21], "#bab5a6", 5);
      if (ring <= 2) {
        // A planted sidewalk along the avenues, with open gaps at each crossing.
        for (const dz of [-6, 4.5]) {
          const tx = x + (col <= 0 ? 12 : -12);
          s.part("box", [tx, 0.14, z + dz], [1.6, 0.07, 1.6], "#676858");
          s.plant([tx, 0.16, z + dz], 4.0, 4.6 + s.random() * 1.2, "oak");
        }
      }
      if (ring === 0) continue;
      const widths = [7.2 + s.random() * 1.5, 7.2 + s.random() * 1.5];
      widths.push(23.2 - widths[0] - widths[1]);
      let left = x - 11.6;
      for (const w of widths) {
        const cx = left + w / 2;
        left += w;
        const depth = 12 + s.random() * 5;
        const cz = z + (s.random() - 0.5) * 1.8;
        const tower = ring >= 2 && s.random() > (ring === 2 ? 0.86 : 0.65);
        const stories = tower
          ? 9 + Math.floor(s.random() * 17)
          : 2 + Math.floor(s.random() * (ring === 1 ? 3 : 5));
        const h = stories * 2.65;
        const palette = tower ? skyline : masonry;
        const color = palette[Math.floor(s.random() * palette.length)];
        s.part("box", [cx, 0.12 + h / 2, cz], [w - 0.08, h, depth], color, tower ? 3 : 2);
        s.part(
          "box",
          [cx, h + 0.18, cz],
          [w + 0.14, 0.3, depth + 0.28],
          tower ? "#94a3a4" : "#c2ae96",
        );
        s.part("box", [cx, h + 0.37, cz], [w - 0.3, 0.14, depth - 0.3], "#606566");
        if (tower) {
          const crown = 3 + s.random() * 8;
          s.part("box", [cx, h + crown / 2, cz], [w * 0.72, crown, depth * 0.72], color, 3);
          if (s.random() > 0.6) s.part("cone", [cx, h + crown + 2, cz], [0.55, 4, 0.55], "#879293");
        } else if (s.random() > 0.75) waterTower(s, cx + w * 0.15, h + 0.4, cz - depth * 0.17);
        else s.part("box", [cx - 1.1, h + 1.05, cz + 2], [2.25, 1.45, 2.7], "#8f887c");
        if (ring === 1) {
          s.part("box", [cx - w * 0.29, h + 0.87, cz - depth * 0.29], [0.7, 1.03, 0.72], "#856451");
          s.part(
            "box",
            [cx - w * 0.29, h + 1.41, cz - depth * 0.29],
            [0.86, 0.15, 0.86],
            "#aa9c89",
          );
          const face = cz + Math.sign(-row || 1) * (depth / 2 + 0.23);
          if (s.random() > 0.48) {
            s.part(
              "box",
              [cx, 2.56, face],
              [w * 0.71, 0.26, 1.18],
              s.random() > 0.5 ? "#506b59" : "#994e3a",
            );
            s.part("box", [cx, 1.08, face], [1.14, 2.05, 0.37], "#414748");
          }
          for (let f = 1; f < stories; f++) {
            s.part("box", [cx + 0.6, f * 2.65 + 0.2, face], [2.5, 0.12, 0.85], "#434947");
            s.part(
              "box",
              [cx + 0.6, f * 2.65 + 0.7, face + Math.sign(-row || 1) * 0.36],
              [2.5, 0.09, 0.08],
              "#434947",
            );
            s.part("box", [cx, f * 2.65 - 0.9, face], [0.11, 2.85, 0.14], "#454948", 0, 0, -0.42);
          }
        }
      }
    }
  }
  return s.finish();
}
