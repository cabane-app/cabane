import { useEffect, useMemo } from "react";
import { BoxGeometry, ExtrudeGeometry, Matrix4 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cutSurfaceShapes } from "../stairs/surface-apertures";
import { planPointToWorld } from "../geometry";
import { ToonMaterial } from "../rendering";
import type { RenderableFloorSpec } from "../types";

/** Visual geometry only: never participates in floor navigation, picking or Walk. */
export function ApartmentFloors({
  floor,
  count,
  base,
}: {
  floor: RenderableFloorSpec;
  count: number;
  base: number;
}) {
  const height = floor.floorToFloorHeightMeters;
  const geometry = useMemo(() => {
    const shapes = cutSurfaceShapes(floor.footprint, floor.coordinates, []);
    const shell = new ExtrudeGeometry(shapes, {
      depth: height - Math.min(0.12, height * 0.1),
      bevelEnabled: false,
    });
    shell.rotateX(-Math.PI / 2);
    const slab = new ExtrudeGeometry(shapes, {
      depth: Math.min(0.12, height * 0.1),
      bevelEnabled: false,
    });
    slab.rotateX(-Math.PI / 2);
    slab.translate(0, height - Math.min(0.12, height * 0.1), 0);
    const panes: BoxGeometry[] = [];
    const points = floor.footprint.map((point) => planPointToWorld(point, floor.coordinates));
    points.forEach(([x, z], index) => {
      const [endX, endZ] = points[(index + 1) % points.length];
      const dx = endX - x,
        dz = endZ - z;
      const length = Math.hypot(dx, dz);
      const windows = Math.floor(length / 2.4);
      for (let i = 0; i < windows; i++) {
        const t = (i + 0.5) / windows;
        const pane = new BoxGeometry(Math.min(1.1, (length / windows) * 0.5), height * 0.42, 0.04);
        pane.rotateY(-Math.atan2(dz, dx));
        pane.translate(x + dx * t, height * 0.55, z + dz * t);
        panes.push(pane);
      }
    });
    const windows = panes.length ? mergeGeometries(panes) : null;
    panes.forEach((pane) => pane.dispose());
    return { shell, slab, windows };
  }, [floor, height]);
  useEffect(
    () => () => {
      geometry.shell.dispose();
      geometry.slab.dispose();
      geometry.windows?.dispose();
    },
    [geometry],
  );
  const matrices = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        new Matrix4().makeTranslation(0, base - (i + 1) * height, 0),
      ),
    [base, count, height],
  );
  return (
    <group name="decorative-apartment-floors">
      {(
        [
          ["shell", "#d1ccc2"],
          ["slab", "#e4dfd5"],
          ["windows", "#83969b"],
        ] as const
      ).map(([kind, color]) => {
        const shape = geometry[kind];
        return (
          shape && (
            <instancedMesh
              key={`${kind}-${count}`}
              args={[shape, undefined, count]}
              raycast={() => {}}
              ref={(mesh) => {
                if (!mesh) return;
                matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
                mesh.instanceMatrix.needsUpdate = true;
                mesh.computeBoundingSphere();
              }}
            >
              <ToonMaterial color={color} />
            </instancedMesh>
          )
        );
      })}
    </group>
  );
}
