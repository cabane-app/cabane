import {
  BatchedMesh,
  Box3,
  BufferAttribute,
  BufferGeometry,
  type Color,
  Matrix3,
  type Matrix4,
  Sphere,
} from "three";

/** Immutable draw inputs captured when the batch's original geometry is baked. */
export interface ToonBatchGeometryInput {
  readonly matrix: Matrix4;
  readonly color: Color;
  readonly vertexColors: boolean;
  readonly transformEligible: boolean;
  readonly ordinaryDepth: boolean;
}

type SourceBounds = {
  revision: string;
  box: Box3;
};

// Source spheres outlive individual packers and their private bounds caches.
const preparedSourceSpheres = new WeakMap<BufferGeometry, { sphere: Sphere; snapshot: Sphere }>();

const attribute = (array: Float32Array, source: BufferAttribute) => {
  const result = new BufferAttribute(array, 3);
  result.name = source.name;
  result.usage = source.usage;
  result.gpuType = source.gpuType;
  return result;
};

/** Own transformed/tinted packing and its source-revision bounds cache. */
export class ToonBatchGeometryPacker {
  private bounds = new WeakMap<BufferGeometry, SourceBounds>();

  private prepareSourceSphere(geometry: BufferGeometry, bounds: SourceBounds, changed: boolean) {
    const current = geometry.boundingSphere;
    const prepared = preparedSourceSpheres.get(geometry);
    // Refresh only helper-prepared spheres. Replacements or in-place
    // authored edits relinquish that ownership and retain their custom bounds.
    const owned =
      current !== null && current === prepared?.sphere && current.equals(prepared.snapshot);
    if (current !== null && !(changed && owned)) {
      if (!owned) preparedSourceSpheres.delete(geometry);
      return;
    }
    const sphere = current ?? new Sphere();
    bounds.box.getCenter(sphere.center);
    const positions = geometry.attributes.position.array as Float32Array;
    let radiusSquared = 0;
    for (let i = 0; i < positions.length; i += 3) {
      const x = sphere.center.x - positions[i],
        y = sphere.center.y - positions[i + 1],
        z = sphere.center.z - positions[i + 2];
      radiusSquared = Math.max(radiusSquared, x * x + y * y + z * z);
    }
    sphere.radius = Math.sqrt(radiusSquared);
    geometry.boundingSphere = sphere;
    preparedSourceSpheres.set(geometry, { sphere, snapshot: sphere.clone() });
  }

  add(
    mesh: BatchedMesh,
    geometry: BufferGeometry,
    revision: string,
    input: ToonBatchGeometryInput,
  ) {
    // Eligibility and the LOD worker provide non-normalized Float32 XYZ attributes.
    const position = geometry.attributes.position as BufferAttribute;
    const normal = geometry.attributes.normal as BufferAttribute;
    const sourcePosition = position.array as Float32Array;
    const sourceNormal = normal.array as Float32Array;
    const sourceColor = input.vertexColors
      ? (geometry.attributes.color.array as Float32Array)
      : null;
    const positions = new Float32Array(sourcePosition.length);
    const normals = new Float32Array(sourceNormal.length);
    const colors = new Float32Array(sourcePosition.length);
    const indices = geometry.index
      ? null
      : position.count > 65535
        ? new Uint32Array(position.count)
        : new Uint16Array(position.count);
    const matrix = input.matrix.elements;
    const normalMatrix = new Matrix3().getNormalMatrix(input.matrix).elements;
    const previous = this.bounds.get(geometry);
    const changed = previous?.revision !== revision;
    const bounds: SourceBounds =
      previous && !changed
        ? previous
        : {
            revision,
            box: new Box3(),
          };
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    let sourceMinX = Infinity,
      sourceMinY = Infinity,
      sourceMinZ = Infinity,
      sourceMaxX = -Infinity,
      sourceMaxY = -Infinity,
      sourceMaxZ = -Infinity;
    const { r, g, b } = input.color;
    for (let i = 0, end = Math.max(positions.length, normals.length); i < end; i += 3) {
      if (i < positions.length) {
        const x = sourcePosition[i],
          y = sourcePosition[i + 1],
          z = sourcePosition[i + 2];
        const w = 1 / (matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15]);
        positions[i] = (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) * w;
        positions[i + 1] = (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) * w;
        positions[i + 2] = (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) * w;
        // Bounds follow the stored Float32 values, including their final rounding.
        minX = Math.min(minX, positions[i]);
        maxX = Math.max(maxX, positions[i]);
        minY = Math.min(minY, positions[i + 1]);
        maxY = Math.max(maxY, positions[i + 1]);
        minZ = Math.min(minZ, positions[i + 2]);
        maxZ = Math.max(maxZ, positions[i + 2]);
        if (changed) {
          sourceMinX = Math.min(sourceMinX, x);
          sourceMaxX = Math.max(sourceMaxX, x);
          sourceMinY = Math.min(sourceMinY, y);
          sourceMaxY = Math.max(sourceMaxY, y);
          sourceMinZ = Math.min(sourceMinZ, z);
          sourceMaxZ = Math.max(sourceMaxZ, z);
        }
        colors[i] = r * (sourceColor ? sourceColor[i] : 1);
        colors[i + 1] = g * (sourceColor ? sourceColor[i + 1] : 1);
        colors[i + 2] = b * (sourceColor ? sourceColor[i + 2] : 1);
        if (indices) indices[i / 3] = i / 3;
      }
      if (i < normals.length) {
        const x = sourceNormal[i],
          y = sourceNormal[i + 1],
          z = sourceNormal[i + 2];
        const nx = normalMatrix[0] * x + normalMatrix[3] * y + normalMatrix[6] * z;
        const ny = normalMatrix[1] * x + normalMatrix[4] * y + normalMatrix[7] * z;
        const nz = normalMatrix[2] * x + normalMatrix[5] * y + normalMatrix[8] * z;
        const scale = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        normals[i] = nx * scale;
        normals[i + 1] = ny * scale;
        normals[i + 2] = nz * scale;
      }
    }
    if (changed) {
      bounds.box.min.set(sourceMinX, sourceMinY, sourceMinZ);
      bounds.box.max.set(sourceMaxX, sourceMaxY, sourceMaxZ);
      this.bounds.set(geometry, bounds);
    }
    this.prepareSourceSphere(geometry, bounds, changed);
    const packed = new BufferGeometry();
    try {
      packed.setAttribute("position", attribute(positions, position));
      packed.setAttribute("normal", attribute(normals, normal));
      packed.setAttribute("color", new BufferAttribute(colors, 3));
      packed.setIndex(geometry.index ?? new BufferAttribute(indices!, 1));
      if (input.ordinaryDepth) {
        const box = new Box3();
        box.min.set(minX, minY, minZ);
        box.max.set(maxX, maxY, maxZ);
        packed.boundingBox = box;
        const affine = matrix[3] === 0 && matrix[7] === 0 && matrix[11] === 0 && matrix[15] === 1;
        packed.boundingSphere =
          input.transformEligible && affine
            ? bounds.box.getBoundingSphere(new Sphere()).applyMatrix4(input.matrix)
            : box.getBoundingSphere(new Sphere());
        // A transformed source sphere must also contain the final Float32 rounding.
        if (!box.isEmpty())
          packed.boundingSphere.radius +=
            Math.max(
              1,
              Math.abs(minX),
              Math.abs(minY),
              Math.abs(minZ),
              Math.abs(maxX),
              Math.abs(maxY),
              Math.abs(maxZ),
            ) *
            2 ** -23 *
            Math.sqrt(3);
      }
      const id = mesh.addGeometry(packed);
      if (!input.ordinaryDepth) {
        // Exact native centers preserve sorting for unusual depth modes.
        mesh.getBoundingBoxAt(id, new Box3());
        mesh.getBoundingSphereAt(id, new Sphere());
      }
      return id;
    } finally {
      packed.dispose();
    }
  }

  clear() {
    this.bounds = new WeakMap();
  }
}
