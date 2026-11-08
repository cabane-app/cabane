import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix3,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

export type Point = [number, number, number];

/** Bake small botanical parts into a handful of static, vertex-coloured meshes. */
export class LandscapeGeometry {
  private positions: number[] = [];
  private colors: number[] = [];
  private normals: number[] = [];
  private tint = new Color();
  private vertex = new Vector3();
  private normal = new Vector3();
  private normalMatrix = new Matrix3();

  add(
    source: BufferGeometry,
    color: string,
    position: Point,
    scale: Point,
    rotation = new Quaternion(),
  ) {
    const transform = new Matrix4().compose(
      new Vector3(...position),
      rotation,
      new Vector3(...scale),
    );
    this.normalMatrix.getNormalMatrix(transform);
    this.tint.set(color);
    const points = source.getAttribute("position"),
      normals = source.getAttribute("normal");
    const count = source.index?.count ?? points.count;
    for (let i = 0; i < count; i++) {
      const index = source.index?.getX(i) ?? i;
      this.vertex.fromBufferAttribute(points, index).applyMatrix4(transform);
      this.normal.fromBufferAttribute(normals, index).applyMatrix3(this.normalMatrix).normalize();
      this.positions.push(...this.vertex.toArray());
      this.normals.push(...this.normal.toArray());
      this.colors.push(this.tint.r, this.tint.g, this.tint.b);
    }
  }

  triangle(a: Point, b: Point, c: Point, color: string | [string, string, string]) {
    this.normal
      .subVectors(new Vector3(...b), new Vector3(...a))
      .cross(new Vector3(...c).sub(new Vector3(...a)))
      .normalize();
    for (const [i, p] of [a, b, c].entries()) {
      this.tint.set(typeof color === "string" ? color : color[i]);
      this.positions.push(...p);
      this.normals.push(...this.normal.toArray());
      this.colors.push(this.tint.r, this.tint.g, this.tint.b);
    }
  }

  finish() {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(this.colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

export function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

export function branchTransform(a: Point, b: Point) {
  const start = new Vector3(...a),
    end = new Vector3(...b);
  const direction = end.clone().sub(start);
  return {
    position: start.add(end).multiplyScalar(0.5).toArray() as Point,
    length: direction.length(),
    rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()),
  };
}
