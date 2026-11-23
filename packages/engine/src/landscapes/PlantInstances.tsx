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
  type Material,
} from "three";
import { plantLodHigh, plantLodLow, type PlantLod } from "./plant-material";
import type { CountryPlanet } from "./country-planet";
import type { Plant } from "./garden-layout";

type Sample = (x: number, z: number) => number;
export const Shelter = createContext<Sample>(() => 0);

type Cell = { start: number; count: number; bounds: Sphere; visible: number; growth: number };
/** Pack spatial neighbours contiguously. A visible cell can be copied with two typed-array writes. */
function plantCells(
  plants: Plant[],
  planet: CountryPlanet,
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
    cover = new Vector3(),
    stepX = new Vector3(),
    stepZ = new Vector3(),
    tangent = new Vector3(),
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
      planet.point(x, z, model.position, normal, cover);
      if (lieFlat) {
        planet.point(x + 0.12, z, stepX, tangent, cover);
        planet.point(x, z + 0.12, stepZ, tangent, cover);
        normal.crossVectors(stepZ.sub(model.position), stepX.sub(model.position)).normalize();
      }
      model.quaternion.setFromUnitVectors(up, normal);
      model.rotateY(angle);
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
    cells.push({ start, count: i - start, bounds, visible: -1, growth: 0 });
  }
  return { cells, transforms, colors };
}

export function PlantInstances({
  name,
  geometry,
  plants,
  planet,
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
  planet: CountryPlanet;
  material?: Material | undefined;
  children?: ReactNode;
  lieFlat?: boolean;
  castShadow?: boolean;
  distant?: boolean;
  detailPixels?: number | undefined;
  lod?: PlantLod | undefined;
}) {
  const mesh = useRef<InstancedMesh>(null),
    shelter = useContext(Shelter);
  const data = useMemo(
    () => plantCells(plants, planet, shelter, lieFlat, distant),
    [plants, planet, shelter, lieFlat, distant],
  );
  const scratch = useMemo(
    () => ({
      view: new Matrix4(),
      clip: new Matrix4(),
      previous: new Matrix4(),
      frustum: new Frustum(),
      center: new Vector3(),
      cameraPosition: new Vector3(),
      core: new Vector3(),
      sight: new Vector3(),
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
    if (perspective) scratch.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    scratch.core.set(planet.cx, -planet.centerDepth, planet.cz).applyMatrix4(scratch.view);
    let changed = false,
      total = 0;
    for (const cell of data.cells) {
      const { center, radius } = cell.bounds;
      // Allow off-screen crowns to cast into the view. The distant hills compress depth in their shader.
      const pad = castShadow ? radius + 5 : radius;
      let visible = cell.count,
        growth = 0;
      if (
        scratch.frustum.planes.some(
          (p, i) => (i !== 4 || !distant) && p.distanceToPoint(center) < -pad,
        )
      )
        visible = 0;
      else if (distant) {
        // Reject a whole cell only when its sight lines pass through solid ground.
        const eye = scratch.center.copy(center).applyMatrix4(scratch.view);
        const sight = scratch.sight;
        if (perspective) sight.copy(eye).normalize();
        else sight.set(0, 0, -1);
        const along = eye.dot(sight) - scratch.core.dot(sight);
        const safeRadius = planet.radius * 0.87 - radius;
        if (
          along > radius &&
          safeRadius > 0 &&
          eye.sub(scratch.core).addScaledVector(sight, -along).lengthSq() < safeRadius * safeRadius
        )
          visible = 0;
      }
      if (visible && (detailPixels || lod)) {
        // A turn in place cannot change a plant's detail. For trees, conservatively
        // submit both representations wherever the per-tree transition can intersect this cell.
        const distance = perspective
          ? scratch.center
              .copy(center)
              .applyMatrix4(batch.matrixWorld)
              .distanceTo(scratch.cameraPosition)
          : 0;
        if (lod && !perspective) {
          if (pixels >= lod.pixels !== lod.near) visible = 0;
        } else if (lod) {
          const largest = pixels / Math.max(1, distance - radius);
          const smallest = pixels / Math.max(1, distance + radius);
          if (lod.near && largest <= lod.pixels * plantLodLow) visible = 0;
          // The mid mesh supplies a stable shadow even where only near foliage is drawn.
          if (!lod.near && !castShadow && smallest >= lod.pixels * plantLodHigh) visible = 0;
        } else if (detailPixels) {
          const scale = perspective ? pixels / Math.max(1, distance - radius * 0.55) : pixels;
          const fraction = Math.min(1, Math.max(0, (scale - 5) / (detailPixels - 5)));
          if (perspective) {
            const band = Math.max(1, cell.count * 0.08);
            growth = fraction * fraction * (cell.count - 1 + band);
            visible = Math.min(cell.count, Math.ceil(growth));
          } else {
            visible = Math.round(cell.count * fraction * fraction);
          }
        }
      }
      changed ||= visible !== cell.visible || growth !== cell.growth;
      cell.growth = growth;
      cell.visible = visible;
      total += visible;
    }
    if (!changed) return;
    batch.count = total;
    batch.visible = total > 0;
    let n = 0;
    for (const { start, visible, count, growth } of data.cells) {
      if (!visible) continue;
      batch.instanceMatrix.array.set(
        data.transforms.subarray(start * 16, (start + visible) * 16),
        n * 16,
      );
      batch.instanceColor.array.set(data.colors.subarray(start * 3, (start + visible) * 3), n * 3);
      if (perspective && detailPixels) {
        // Ease only the fringe of the stable prefix up from its own roots.
        const band = Math.max(1, count * 0.08);
        for (let j = Math.max(0, Math.floor(growth - band) + 1); j < visible; j++) {
          const t = Math.min(1, (growth - j) / band);
          const size = t * t * (3 - 2 * t);
          const offset = (n + j) * 16;
          for (let k = 0; k < 12; k++) batch.instanceMatrix.array[offset + k] *= size;
        }
      }
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
