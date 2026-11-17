import { Vector3 } from "three";
import { pointInsidePolygon, polygonSignedArea } from "../geometry";

type Point = [number, number];
type Vertex = { xz: Point; y: number; parent: number; upArea: number; downArea: number };
type Section = { points: Point[]; bottomY: number; upArea: number; downArea: number };

const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function convexHull(points: Point[]) {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (sequence: Point[]) => {
    const result: Point[] = [];
    for (const p of sequence) {
      while (result.length >= 2 && cross(result.at(-2)!, result.at(-1)!, p) <= 1e-12) result.pop();
      result.push(p);
    }
    result.pop();
    return result;
  };
  return [...half(points), ...half(points.reverse())];
}

// Keep actual extreme vertices. A densely rounded corner must not displace
// the important straight sides when reducing an imported perimeter.
function limitHull(hull: Point[]) {
  if (hull.length <= 32) return hull;
  const selected = new Set<number>();
  for (let i = 0; i < 32; i++) {
    const angle = (i * Math.PI) / 16;
    const x = Math.cos(angle),
      z = Math.sin(angle);
    let best = -Infinity,
      index = 0;
    hull.forEach((p, j) => {
      const projection = p[0] * x + p[1] * z;
      if (projection > best) {
        best = projection;
        index = j;
      }
    });
    selected.add(index);
  }
  return hull.filter((_, i) => selected.has(i));
}

/** Weld the clipped triangles at UV/material seams, retaining discrete feet. */
export class ContactSlice {
  private readonly ceiling: number;
  private readonly vertices: Vertex[] = [];
  private readonly ids = new Map<string, number>();
  private readonly intersection = new Vector3();
  private readonly clipped: number[] = [];
  private triangles = 0;

  constructor(ceiling: number) {
    this.ceiling = ceiling;
  }

  private id(p: Vector3) {
    const precision = 100_000;
    const key = `${Math.round(p.x * precision)},${Math.round(p.y * precision)},${Math.round(p.z * precision)}`;
    let id = this.ids.get(key);
    if (id === undefined) {
      id = this.vertices.length;
      this.ids.set(key, id);
      this.vertices.push({ xz: [p.x, p.z], y: p.y, parent: id, upArea: 0, downArea: 0 });
    }
    return id;
  }

  private root(id: number) {
    while (id !== this.vertices[id].parent) {
      const parent = this.vertices[id].parent;
      this.vertices[id].parent = this.vertices[parent].parent;
      id = this.vertices[id].parent;
    }
    return id;
  }

  add(triangle: Vector3[]) {
    if (
      triangle[0].y > this.ceiling &&
      triangle[1].y > this.ceiling &&
      triangle[2].y > this.ceiling
    )
      return true;
    if (++this.triangles > 4096) return false;
    const polygon = this.clipped;
    polygon.length = 0;
    let previous = triangle[2];
    for (const point of triangle) {
      if (previous.y <= this.ceiling !== point.y <= this.ceiling) {
        const t = (this.ceiling - previous.y) / (point.y - previous.y);
        polygon.push(this.id(this.intersection.lerpVectors(previous, point, t)));
      }
      if (point.y <= this.ceiling) polygon.push(this.id(point));
      previous = point;
    }
    if (polygon.length < 3) return true;
    const root = this.root(polygon[0]);
    for (let i = 1; i < polygon.length; i++) this.vertices[this.root(polygon[i])].parent = root;
    const vertex = this.vertices[polygon[0]];
    let area = 0;
    for (let i = 2; i < polygon.length; i++)
      area += cross(vertex.xz, this.vertices[polygon[i - 1]].xz, this.vertices[polygon[i]].xz);
    if (area < 0) vertex.upArea -= area * 0.5;
    else vertex.downArea += area * 0.5;
    return true;
  }

  footprints() {
    const sections = new Map<number, Section>();
    this.vertices.forEach((vertex, id) => {
      const root = this.root(id);
      let section = sections.get(root);
      if (!section) {
        section = { points: [], bottomY: Infinity, upArea: 0, downArea: 0 };
        sections.set(root, section);
      }
      section.points.push(vertex.xz);
      section.bottomY = Math.min(section.bottomY, vertex.y);
      section.upArea += vertex.upArea;
      section.downArea += vertex.downArea;
    });
    const result: { polygon: Point[]; bottomY: number }[] = [];
    for (const section of sections.values()) {
      const hull = convexHull(section.points);
      const area = polygonSignedArea(hull);
      // Open shells and strongly concave/ring-shaped soles have empty space
      // inside the hull. Do not fill that space with a convex contact shadow.
      if (area < 1e-6 || Math.max(section.upArea, section.downArea) < area * 0.94) continue;
      result.push({ polygon: limitHull(hull), bottomY: section.bottomY });
      if (result.length > 64) return [];
    }
    // A metal lamp body may start a few millimetres above a rubber sole.
    // Its underside touches the sole, not the table beneath that same centre.
    return result.filter(({ polygon, bottomY }) => {
      const center: Point = [0, 0];
      for (const [x, z] of polygon) {
        center[0] += x / polygon.length;
        center[1] += z / polygon.length;
      }
      return !result.some(
        (lower) => lower.bottomY < bottomY - 0.0001 && pointInsidePolygon(center, lower.polygon),
      );
    });
  }
}
