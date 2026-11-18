import {
  BoxGeometry,
  CylinderGeometry,
  BufferGeometry,
  Color,
  Euler,
  Matrix3,
  Matrix4,
  Quaternion,
  Vector3,
  Float32BufferAttribute,
} from "three";

import { GroundShade } from "./ground-shade";

const forms = {
  box: new BoxGeometry(),
  cylinder: new CylinderGeometry(1, 1, 1, 12),
  cone: new CylinderGeometry(0, 1, 1, 12),
  gable: new CylinderGeometry(1, 1, 1, 3).rotateX(-Math.PI / 2).rotateY(Math.PI / 2),
};
type Point = [number, number, number];

// Bake repeated silhouettes into a single indexed draw. The surface id selects
// field rows or facade detailing without a separate material for every building.
export class Scenery {
  private shade = new GroundShade();
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private surfaces: number[] = [];
  private foliage: number[] = [];
  private indices: number[] = [];
  private matrix = new Matrix4();
  private normalMatrix = new Matrix3();
  private vertex = new Vector3();
  private color = new Color();
  private seed = 41278;

  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  part(
    form: keyof typeof forms,
    at: Point,
    size: Point,
    color: string,
    surface = 0,
    yaw = 0,
    roll = 0,
  ) {
    if ((surface === 2 || surface === 3) && at[1] - size[1] / 2 < 0.2)
      this.shade.add(at[0], at[2], size[0] / 2 + 2, size[2] / 2 + 2, true);
    this.geometry(forms[form], at, size, color, surface, yaw, roll);
  }

  geometry(
    geometry: BufferGeometry,
    at: Point,
    size: Point,
    tint: string,
    surface: number,
    yaw = 0,
    roll = 0,
  ) {
    this.matrix.compose(
      new Vector3(...at),
      new Quaternion().setFromEuler(new Euler(0, yaw, roll, "YXZ")),
      new Vector3(...size),
    );
    this.normalMatrix.getNormalMatrix(this.matrix);
    this.color.set(tint);
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const offset = this.positions.length / 3;
    for (let i = 0; i < positions.count; i++) {
      const v = this.vertex.fromBufferAttribute(positions, i).applyMatrix4(this.matrix);
      this.positions.push(v.x, v.y, v.z);
      v.fromBufferAttribute(normals, i).applyNormalMatrix(this.normalMatrix);
      this.normals.push(v.x, v.y, v.z);
      this.colors.push(this.color.r, this.color.g, this.color.b);
      this.surfaces.push(surface);
      this.foliage.push(0, 0, 0, 0);
    }
    const index = geometry.index;
    for (let i = 0; i < (index?.count ?? positions.count); i++)
      this.indices.push(offset + (index ? index.getX(i) : i));
  }

  plant(at: Point, width: number, height: number, species: "oak" | "hedge") {
    this.shade.add(at[0], at[2], width * 0.6, species === "oak" ? width * 0.46 : height * 0.8);
    const first = this.positions.length / 3;
    const tile = species === "oak" ? 0 : 0.5;
    const mirror = this.random() < 0.5;
    const shade = 0.84 + this.random() * 0.2;
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]) {
      this.positions.push(...at);
      this.normals.push(0, 1, 0);
      this.colors.push(shade * 1.06, shade, shade * 0.91);
      this.surfaces.push(6);
      this.foliage.push(tile + (mirror ? 1 - u : u) * 0.5, v, (u - 0.5) * width, v * height);
    }
    this.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }

  finish() {
    const result = new BufferGeometry();
    result.setAttribute("foliage", new Float32BufferAttribute(this.foliage, 4));
    result.setIndex(this.indices);
    result.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
    result.setAttribute("normal", new Float32BufferAttribute(this.normals, 3));
    result.setAttribute("color", new Float32BufferAttribute(this.colors, 3));
    result.setAttribute("surface", new Float32BufferAttribute(this.surfaces, 1));
    return { geometry: result, shade: this.shade.texture() };
  }
}
