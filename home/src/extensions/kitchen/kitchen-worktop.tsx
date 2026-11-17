import { ToonMaterial } from "@cabane/engine";
import { KITCHEN_STONE, type KitchenVector3 } from "./kitchen-finish";
import { MilledSurface, type Face } from "./milled-surface";

type Point = readonly [number, number];
const top = 0.9175,
  bottom = 0.8325,
  edge = 0.005;
// Insets are applied to all exposed contours, including the sink's cut edge.
function perimeter(e: number): Point[] {
  return [
    [0.78 + e, 0.01 + e],
    [3.76 - e, 0.01 + e],
    [3.76 - e, 0.25 + e],
    [3.95 - e, 0.25 + e],
    [3.95 - e, 2.55 - e],
    [1.23 + e, 2.55 - e],
    [1.23 + e, 1.65 + e],
    [3.13 + e, 1.65 + e],
    [3.13 + e, 0.65 - e],
    [0.78 + e, 0.65 - e],
  ];
}
function opening(e: number): Point[] {
  return [
    [2.306 - e, 0.174 - e],
    [2.306 - e, 0.506 + e],
    [2.794 + e, 0.506 + e],
    [2.794 + e, 0.174 - e],
  ];
}
function at([x, z]: Point, y: number): KitchenVector3 {
  return [x, y, z];
}
const faces: Face[] = [];
for (const outline of [perimeter, opening]) {
  const rim = outline(0),
    inset = outline(edge);
  for (let i = 0; i < rim.length; i++) {
    const j = (i + 1) % rim.length;
    for (const [a, b, c, d] of [
      [
        at(inset[i]!, bottom),
        at(rim[i]!, bottom + edge),
        at(rim[j]!, bottom + edge),
        at(inset[j]!, bottom),
      ],
      [
        at(rim[i]!, bottom + edge),
        at(rim[i]!, top - edge),
        at(rim[j]!, top - edge),
        at(rim[j]!, bottom + edge),
      ],
      [at(rim[i]!, top - edge), at(inset[i]!, top), at(inset[j]!, top), at(rim[j]!, top - edge)],
    ] as const)
      faces.push([a, b, c, d]);
  }
}
const p = perimeter(edge),
  h = opening(edge);
const xs = [...new Set([...p, ...h].map((v) => v[0]))].sort((a, b) => a - b);
const zs = [...new Set([...p, ...h].map((v) => v[1]))].sort((a, b) => a - b);
for (let i = 1; i < xs.length; i++)
  for (let j = 1; j < zs.length; j++) {
    const l = xs[i - 1]!,
      r = xs[i]!,
      n = zs[j - 1]!,
      s = zs[j]!,
      x = (l + r) / 2,
      z = (n + s) / 2;
    const inside = (loop: Point[]) =>
      loop.filter(([a, b], k) => {
        const [c, d] = loop[(k + 1) % loop.length]!;
        return b > z !== d > z && x < a + ((c - a) * (z - b)) / (d - b);
      }).length %
        2 ===
      1;
    if (!inside(p) || inside(h)) continue;
    faces.push(
      [
        [l, top, n],
        [l, top, s],
        [r, top, s],
        [r, top, n],
      ],
      [
        [l, bottom, n],
        [r, bottom, n],
        [r, bottom, s],
        [l, bottom, s],
      ],
    );
  }
export function KitchenWorktop() {
  return (
    <mesh castShadow receiveShadow>
      <MilledSurface faces={faces} />
      <ToonMaterial color={KITCHEN_STONE} />
    </mesh>
  );
}
