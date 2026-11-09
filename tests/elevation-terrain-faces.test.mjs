import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { DioramaGround } = await load("/packages/engine/src/architecture-scene/DioramaGround.tsx");
  const { ElevationEdges } = await load("/packages/engine/src/elevation/ElevationEdges.tsx");
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const { createTerrainSurface } = await load("/packages/engine/src/terrain/terrain-surface.ts");
  const { TerrainSurfaceContext } = await load("/packages/engine/src/terrain/TerrainSurface.tsx");
  const { planPointToWorld } = await load("/packages/engine/src/geometry.ts");
  for (const scale of [1, 0.37])
    for (const sloping of [false, true])
      test(`house-facing terrace face: scale ${scale}, sloping terrain ${sloping}`, async () => {
        const polygon = [
          [0, -3],
          [3, -3],
          [3, -0.2],
          [0, -0.2],
        ];
        const floor = {
          ...structuredClone(neutralDemoManifest.floors[0]),
          coordinates: {
            origin: scale === 1 ? [0, 0] : [8.25, -2.1],
            metersPerPlanUnit: scale,
            scaleBasis: "measured",
          },
          rooms: [],
          outdoorPlatforms: [
            {
              id: "terrace",
              polygon,
              elevation: {
                offsetMeters: -0.5,
                edges: polygon.map((_, i) => ({
                  id: `e${i}`,
                  ...(i === 0 ? { transition: { kind: "sloped", widthMeters: 0.6 } } : {}),
                })),
              },
            },
          ],
        };
        const terrain = createTerrainSurface(
          sloping
            ? { topLeftMeters: 0.1, topRightMeters: 0.2, bottomLeftMeters: 0, bottomRightMeters: 0 }
            : undefined,
          [floor],
        );
        const center = planPointToWorld([1.5, -1.5], floor.coordinates);
        const renderer = await create(
          createElement(
            TerrainSurfaceContext.Provider,
            { value: terrain },
            createElement(
              "group",
              null,
              createElement(DioramaGround, {
                floor,
                centerX: center[0],
                centerZ: center[1],
                size: 10,
                color: "#91a06a",
              }),
              createElement(ElevationEdges, { floor }),
            ),
          ),
        );
        try {
          const scene = renderer.scene.instance;
          scene.updateMatrixWorld(true);
          const origin = planPointToWorld([1.2, -1], floor.coordinates);
          const edge = planPointToWorld([1.2, -0.2], floor.coordinates);
          for (const height of [(terrain?.offsetAt(...edge) ?? 0) - 0.1, -0.25]) {
            const hits = new Raycaster(
              new Vector3(origin[0], height, origin[1]),
              new Vector3(0, 0, 1),
              0,
              0.81 * scale,
            ).intersectObject(scene, true);
            assert.deepEqual(
              hits.map((hit) => hit.object.name),
              ["elevation-transitions"],
              `Only the retaining face should render at height ${height}; duplicate meshes flicker`,
            );
          }
        } finally {
          await renderer.unmount();
        }
      });
});
