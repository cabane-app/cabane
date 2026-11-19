import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Box3,
  Color,
  DynamicDrawUsage,
  Frustum,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  Sphere,
  Vector3,
  type BufferGeometry,
  type MeshStandardMaterial,
} from "three";
import type { Plant } from "./garden-layout";

type Sample = (x: number, z: number) => number;
export const Shelter = createContext<Sample>(() => 0);

type Cell = { start: number; count: number; bounds: Sphere; visible: number };
/** Pack spatial neighbours contiguously. A visible cell can be copied with two typed-array writes. */
function plantCells(
  plants: Plant[],
  height: Sample,
  shelter: Sample,
  lieFlat: boolean,
  distant: boolean,
) {
  const divisions = new Map<string, Plant[]>();
  const span = distant ? 26 : 9;
  for (const p of plants) {
    const key = Math.floor(p.x / span) + "," + Math.floor(p.z / span);
    const cell = divisions.get(key);
    if (cell) cell.push(p);
    else divisions.set(key, [p]);
  }
  const transforms = new Float32Array(plants.length * 16),
    colors = new Float32Array(plants.length * 3);
  const model = new Object3D(),
    up = new Vector3(0, 1, 0),
    normal = new Vector3(),
    tint = new Color();
  const cells: Cell[] = [];
  let i = 0;
  for (const group of divisions.values()) {
    const start = i,
      box = new Box3();
    let padding = 0;
    // A stable, shuffled prefix reduces fine ground cover evenly as its blades shrink on screen.
    group.sort((a, b) => ((a.tone * 31.7) % 1) - ((b.tone * 31.7) % 1));
    for (const { x, z, angle, size, width, tone } of group) {
      model.position.set(x, height(x, z), z);
      model.rotation.set(0, angle, 0);
      if (lieFlat) {
        normal
          .set(
            height(x - 0.25, z) - height(x + 0.25, z),
            0.5,
            height(x, z - 0.25) - height(x, z + 0.25),
          )
          .normalize();
        model.quaternion.setFromUnitVectors(up, normal);
        model.rotateY(angle);
      }
      model.scale.set(size * width, size, size * width * (0.92 + 0.16 * tone));
      model.updateMatrix();
      model.matrix.toArray(transforms, i * 16);
      const shade = size < 3 ? shelter(x, z) : 0;
      tint
        .setRGB(
          (0.81 + 0.19 * tone) * (1 - 0.47 * shade),
          (0.85 + 0.13 * tone) * (1 - 0.37 * shade),
          (0.79 + 0.2 * tone) * (1 - 0.32 * shade),
        )
        .toArray(colors, i * 3);
      box.expandByPoint(model.position);
      padding = Math.max(padding, size * Math.max(1, width));
      i++;
    }
    const bounds = box.getBoundingSphere(new Sphere());
    bounds.radius += padding;
    cells.push({ start, count: i - start, bounds, visible: -1 });
  }
  return { cells, transforms, colors };
}

export function PlantInstances({
  name,
  geometry,
  plants,
  height,
  material,
  children,
  lieFlat = false,
  castShadow = true,
  distant = false,
  detailPixels,
  lod,
}: {
  name: string;
  geometry: BufferGeometry;
  plants: Plant[];
  height: Sample;
  material?: MeshStandardMaterial | undefined;
  children?: ReactNode;
  lieFlat?: boolean;
  castShadow?: boolean;
  distant?: boolean;
  detailPixels?: number | undefined;
  lod?: "near" | "mid" | undefined;
}) {
  const mesh = useRef<InstancedMesh>(null),
    shelter = useContext(Shelter);
  const data = useMemo(
    () => plantCells(plants, height, shelter, lieFlat, distant),
    [plants, height, shelter, lieFlat, distant],
  );
  const scratch = useMemo(
    () => ({
      view: new Matrix4(),
      clip: new Matrix4(),
      previous: new Matrix4(),
      frustum: new Frustum(),
      center: new Vector3(),
      pixels: 0,
      first: true,
    }),
    [],
  );
  useLayoutEffect(() => {
    const batch = mesh.current;
    if (!batch) return;
    batch.instanceMatrix.setUsage(DynamicDrawUsage);
    batch.instanceColor ??= new InstancedBufferAttribute(
      new Float32Array(plants.length * 3),
      3,
    ).setUsage(DynamicDrawUsage);
    batch.count = 0;
    batch.visible = false;
    scratch.first = true;
    for (const cell of data.cells) cell.visible = -1;
  }, [data, plants.length, scratch]);
  useFrame(({ camera, gl }) => {
    const batch = mesh.current;
    if (!batch?.instanceColor) return;
    camera.updateWorldMatrix(true, false);
    batch.updateWorldMatrix(true, false);
    scratch.view.multiplyMatrices(camera.matrixWorldInverse, batch.matrixWorld);
    scratch.clip.multiplyMatrices(camera.projectionMatrix, scratch.view);
    const pixels = gl.domElement.height * Math.abs(camera.projectionMatrix.elements[5]) * 0.5;
    if (!scratch.first && scratch.pixels === pixels && scratch.previous.equals(scratch.clip))
      return;
    scratch.first = false;
    scratch.pixels = pixels;
    scratch.previous.copy(scratch.clip);
    scratch.frustum.setFromProjectionMatrix(scratch.clip);
    const perspective = camera.projectionMatrix.elements[15] === 0;
    let changed = false,
      total = 0;
    for (const cell of data.cells) {
      const { center, radius } = cell.bounds;
      // Allow off-screen crowns to cast into the view. The distant hills compress depth in their shader.
      const pad = castShadow ? radius + 5 : radius;
      let visible = cell.count;
      if (
        scratch.frustum.planes.some(
          (p, i) => (i !== 4 || !distant) && p.distanceToPoint(center) < -pad,
        )
      )
        visible = 0;
      else if (detailPixels || lod) {
        const z = -scratch.center.copy(center).applyMatrix4(scratch.view).z;
        const scale = perspective ? pixels / Math.max(1, z - radius * 0.55) : pixels;
        if (lod) {
          if (scale >= 40 !== (lod === "near")) visible = 0;
        } else if (detailPixels) {
          const fraction = Math.min(1, Math.max(0, (scale - 5) / (detailPixels - 5)));
          visible = Math.round(cell.count * fraction * fraction);
        }
      }
      changed ||= visible !== cell.visible;
      cell.visible = visible;
      total += visible;
    }
    if (!changed) return;
    batch.count = total;
    batch.visible = total > 0;
    let n = 0;
    for (const { start, visible } of data.cells) {
      if (!visible) continue;
      batch.instanceMatrix.array.set(
        data.transforms.subarray(start * 16, (start + visible) * 16),
        n * 16,
      );
      batch.instanceColor.array.set(data.colors.subarray(start * 3, (start + visible) * 3), n * 3);
      n += visible;
    }
    if (total) {
      batch.instanceMatrix.clearUpdateRanges();
      batch.instanceMatrix.addUpdateRange(0, n * 16);
      batch.instanceMatrix.needsUpdate = true;
      batch.instanceColor.clearUpdateRanges();
      batch.instanceColor.addUpdateRange(0, n * 3);
      batch.instanceColor.needsUpdate = true;
    }
  });
  return (
    <instancedMesh
      ref={mesh}
      name={name}
      args={[geometry, material, plants.length]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
      raycast={() => {}}
    >
      {children}
    </instancedMesh>
  );
}
