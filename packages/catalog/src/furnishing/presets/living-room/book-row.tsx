import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { BoxGeometry, CylinderGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { useMemo, useEffect } from "react";
export const BOOK_ROW_SIZE = [0.4, 0.28, 0.18] as const;
const cloth = ["#e5dfcc", "#c1c7b9", "#364940", "#d3aa60", "#b46d53"];
/** Bound volumes: cloth boards stand proud of the deckle, with round-backed sewn spines. */
function makeVolumes() {
  const batches = new Map<string, BufferGeometry[]>();
  function add(color: string, g: BufferGeometry) {
    const parts = batches.get(color) ?? [];
    parts.push(g);
    batches.set(color, parts);
  }
  const widths = [0.042, 0.027, 0.047, 0.052, 0.031, 0.035, 0.052, 0.03, 0.049, 0.035];
  let left = -0.2;
  widths.forEach((width, i) => {
    const x = left + width / 2;
    left += width;
    const h = [0.214, 0.199, 0.257, 0.28, 0.221, 0.215, 0.25, 0.238, 0.265, 0.217][i];
    const d = 0.18 - ((i * 3) % 5) * 0.006,
      rear = -d / 2,
      front = d / 2;
    const cover = cloth[i % 5];
    const gap = i === 0 || i === 9 ? 0 : 0.0008,
      w = width - gap;
    add(
      "#e1d6b9",
      new BoxGeometry(w - 0.006, h - 0.006, d - 0.011).translate(x, h / 2, rear + d / 2 + 0.002),
    );
    for (const side of [-1, 1])
      add(
        cover,
        new BoxGeometry(0.0028, h, d - 0.006).translate(
          x + (side * (w - 0.0028)) / 2,
          h / 2,
          -0.003,
        ),
      );
    const spine = new CylinderGeometry(1, 1, h, 16)
      .scale(w / 2, 1, 0.007)
      .translate(x, h / 2, front - 0.007);
    add(cover, spine);
    if (i % 3 !== 1)
      for (const y of [h * 0.74, h * 0.78, 0.021])
        add("#c0a67a", new BoxGeometry(w * 0.55, 0.0024, 0.0024).translate(x, y, front - 0.0012));
  });
  return Array.from(batches, ([color, parts]) => {
    const geometry = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return { color, geometry };
  });
}
export function BookRow({ size = BOOK_ROW_SIZE }: { size?: SceneItemSize; variant?: string }) {
  const bindings = useMemo(makeVolumes, []);
  useEffect(() => () => bindings.forEach((b) => b.geometry.dispose()), [bindings]);
  return (
    <group name="book-row" scale={[size[0] / 0.4, size[1] / 0.28, size[2] / 0.18]}>
      {bindings.map(({ color, geometry }) => (
        <mesh key={color} geometry={geometry} castShadow receiveShadow>
          <ToonMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}
