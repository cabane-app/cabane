import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { create } from "@react-three/test-renderer";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { withModules } from "./test-server.mjs";
import { testGlb } from "./fixtures/personal-glb.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const box = (size, at) => new BoxGeometry(...size).translate(...at);
function colliderRoot(...geometries) {
  const root = new Group();
  root.userData.walkCollider = true;
  for (const geometry of geometries) {
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.userData.importedModel = true;
    root.add(mesh);
  }
  return root;
}
const point = (root, x, z) => {
  const world = root.localToWorld(new Vector3(x, 0, z));
  return { x: world.x, z: world.z };
};

await withModules(async (load) => {
  const { collectSceneWalkColliders } = await load(
    "/packages/engine/src/navigation/scene-walk-colliders.ts",
  );
  const { isWalkPointClear, walkCollidersForVerticalRange } = await load(
    "/packages/engine/src/navigation/walk-colliders.ts",
  );
  const { walkJumpVerticalRange, WALK_JUMP_APEX } = await load(
    "/packages/engine/src/navigation/walk-jump.ts",
  );
  const { ImportedModelGeometry } = await load(
    "/packages/engine/src/imported-models/ImportedModel.tsx",
  );
  const { acquireGlb, loadGlb, disposeGlb } = await load(
    "/packages/engine/src/imported-models/glb-resources.ts",
  );
  const { resolveWalkLanding } = await load("/packages/engine/src/navigation/walk-landing.ts");
  const { modelAssetHash } = await load("/packages/engine/src/imported-models/contracts.ts");
  const { WalkCameraController } = await load("/packages/engine/src/WalkCameraController.tsx");
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");

  test("a single-mesh L with a rug keeps its hollow accessible after normalization, yaw and resizing", () => {
    const kitchen = mergeGeometries([
      box([2.55, 0.9, 0.6], [0, 0.45, -0.85]),
      box([0.6, 0.9, 2.3], [-0.975, 0.45, 0]),
      box([2.55, 0.02, 2.3], [0, 0.01, 0]),
    ]);
    const root = colliderRoot(kitchen);
    const helper = new Mesh(box([2.55, 0.9, 2.3], [0, 0.45, 0]));
    helper.visible = false;
    root.add(helper);
    const scene = new Group(),
      normalization = new Group();
    normalization.rotation.y = -Math.PI / 2;
    normalization.add(root);
    scene.position.set(-3, 3.2, 4);
    scene.rotation.y = Math.PI / 4;
    scene.scale.setScalar(1.4);
    scene.add(normalization);
    const colliders = collectSceneWalkColliders(scene, 3.2);
    assert.ok(colliders.length > 1 && colliders.length < 100, `${colliders.length} boxes`);
    assert.equal(isWalkPointClear(point(root, 0.3, 0.3), colliders), true);
    assert.equal(isWalkPointClear(point(root, -0.975, 0.3), colliders), false);
    assert.equal(isWalkPointClear(point(root, 0.3, -0.85), colliders), false);
    assert.equal(collectSceneWalkColliders(scene, 3.2)[0], colliders[0], "reuse cached raster");
    const oldCounter = point(root, 0.3, -0.85);
    normalization.position.x += 5;
    const moved = collectSceneWalkColliders(scene, 3.2);
    assert.equal(isWalkPointClear(oldCounter, moved), true);
    assert.equal(isWalkPointClear(point(root, 0.3, -0.85), moved), false);
  });

  test("flat rugs are traversable while low furniture, tall obstacles and overhead geometry retain their heights", () => {
    const parts = [
      box([5, 0.05, 3], [0, 0.025, 0]),
      mergeGeometries([box([0.6, 0.4, 0.6], [-1.5, 0.2, 0]), box([0.6, 2.3, 0.6], [1.5, 1.15, 0])]),
      box([0.6, 0.1, 0.6], [0, 2.25, 0]),
    ];
    for (const geometries of [parts, [mergeGeometries(parts)]]) {
      const scene = colliderRoot(...geometries);
      const all = collectSceneWalkColliders(scene, 0);
      const ground = walkCollidersForVerticalRange(all, walkJumpVerticalRange(0, 0));
      const airborne = walkCollidersForVerticalRange(all, walkJumpVerticalRange(0, WALK_JUMP_APEX));
      assert.equal(isWalkPointClear({ x: 0, z: 1 }, ground), true, "rug alone");
      assert.equal(isWalkPointClear({ x: -1.5, z: 0 }, ground), false, "low table");
      assert.equal(isWalkPointClear({ x: -1.5, z: 0 }, airborne), true, "jump clears low table");
      assert.equal(isWalkPointClear({ x: 1.5, z: 0 }, airborne), false, "tall cupboard");
      assert.equal(isWalkPointClear({ x: 0, z: 0 }, ground), true, "space under high shelf");
      assert.equal(isWalkPointClear({ x: 0, z: 0 }, airborne), false, "jump reaches shelf");
      const landing = collectSceneWalkColliders(scene, 0, 1.72);
      assert.equal(isWalkPointClear({ x: 0, z: 0 }, landing), true);
      assert.equal(isWalkPointClear({ x: 1.5, z: 0 }, landing), false);
    }
  });

  test("closed cabinets reject tool arrivals whether GLB faces share one primitive or six", async () => {
    const polygon = [
      [0, 0],
      [8, 0],
      [8, 8],
      [0, 8],
    ];
    const floor = {
      ...structuredClone(neutralDemoManifest.floors[0]),
      footprint: polygon,
      rooms: [{ ...neutralDemoManifest.floors[0].rooms[0], polygon, devices: [] }],
      walls: [],
      wallJunctions: [],
      openings: [],
      ceilings: [],
    };
    const building = {
      coordinates: floor.coordinates,
      floors: [floor],
      stairs: [],
      sceneItems: [],
    };
    for (const split of [false, true]) {
      const bytes = testGlb({
        mutate(json) {
          json.nodes[0].scale = [1.2, 4.6, 3];
          json.nodes[0].translation = [0, 1.15, 0];
          if (split)
            json.meshes[0].primitives = Array.from({ length: 6 }, (_, face) => {
              const index = json.accessors.length;
              json.accessors.push({ ...json.accessors[0], count: 6, byteOffset: face * 6 * 3 * 4 });
              return { attributes: { POSITION: index }, material: 0 };
            });
        },
      });
      const resource = await loadGlb(bytes);
      try {
        assert.equal(resource.complexity.visibleMeshes, split ? 6 : 1);
        const scene = colliderRoot();
        scene.position.set(3, 0, 3);
        scene.add(resource.root);
        const landing = resolveWalkLanding(building, { x: 3, y: 0, z: 3 }, (elevation) =>
          collectSceneWalkColliders(scene, elevation, 1.72),
        );
        assert.equal(landing, null, `closed cabinet with ${split ? "six" : "one"} primitives`);
      } finally {
        disposeGlb(resource.root);
      }
    }
  });

  test("GPU-instanced GLB parts preserve empty space and per-instance transforms", () => {
    const mesh = new InstancedMesh(new BoxGeometry(0.6, 0.8, 0.6), new MeshBasicMaterial(), 2);
    mesh.userData.importedModel = true;
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(-1.5, 0.4, 0));
    mesh.setMatrixAt(1, new Matrix4().makeTranslation(1.5, 0.4, 0));
    const root = colliderRoot();
    root.add(mesh);
    root.rotation.y = Math.PI / 3;
    const colliders = collectSceneWalkColliders(root, 0);
    assert.equal(isWalkPointClear(point(root, 0, 0), colliders), true);
    assert.equal(isWalkPointClear(point(root, -1.5, 0), colliders), false);
    assert.equal(isWalkPointClear(point(root, 1.5, 0), colliders), false);
  });

  test("triangle, cell and box budgets preserve a conservative envelope with bounded work", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0, 8, 1, 0, 0, 1, 8]), 3),
    );
    geometry.setIndex(
      new BufferAttribute(
        Uint32Array.from({ length: 300_000 }, (_, index) => index % 3),
        1,
      ),
    );
    const root = colliderRoot(geometry);
    const mesh = root.children[0];
    const getVertex = mesh.getVertexPosition.bind(mesh);
    let visits = 0;
    mesh.getVertexPosition = (...args) => {
      visits++;
      return getVertex(...args);
    };
    const result = collectSceneWalkColliders(root, 0);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, root.uuid, "cell budget falls back to envelope");
    assert.ok(visits < 300, `${visits} vertex visits before cell budget`);
    assert.equal(isWalkPointClear({ x: 7, z: 7 }, result), false, "no dropped obstacles");
    const oversized = colliderRoot(geometry.clone());
    oversized.children[0].geometry.setIndex(new BufferAttribute(new Uint32Array(300_003), 1));
    oversized.children[0].getVertexPosition = () => {
      throw Error("triangle budget must run first");
    };
    assert.equal(collectSceneWalkColliders(oversized, 0)[0].id, oversized.uuid);
    const fragmented = colliderRoot(
      mergeGeometries(
        Array.from({ length: 257 }, (_, index) =>
          box([0.04, 0.3, 0.04], [(index % 17) * 0.24, 0.15, Math.floor(index / 17) * 0.24]),
        ),
      ),
    );
    assert.equal(collectSceneWalkColliders(fragmented, 0)[0].id, fragmented.uuid, "box budget");
  });

  test(
    "asynchronous GLB load and replacement refresh movement and tool arrivals on the same floor",
    { timeout: 5000 },
    async () => {
      const shape = (nodes) =>
        testGlb({
          mutate(json) {
            json.nodes = nodes;
            json.scenes[0].nodes = nodes.map((_, index) => index);
          },
        });
      const bytes = [
        shape([
          { mesh: 0, scale: [2.55, 1.8, 1.5], translation: [0, 0.45, -0.85] },
          { mesh: 0, scale: [0.6, 1.8, 5.75], translation: [-0.975, 0.45, 0] },
        ]),
        shape([{ mesh: 0, scale: [2.55, 1.8, 5.75], translation: [0, 0.45, 0] }]),
      ];
      const leases = [],
        gates = [],
        assets = [];
      for (const source of bytes) {
        const asset = { sha256: await modelAssetHash(source), byteLength: source.byteLength };
        const gate = Promise.withResolvers();
        assets.push(asset);
        gates.push(gate);
        leases.push(acquireGlb(asset, { read: () => gate.promise }));
      }
      const model = {
        id: "custom:00000000-0000-4000-8000-000000000035",
        name: "Synthetic kitchen",
        placement: "floor",
        profile: "furniture",
        asset: assets[0],
        complexity: { triangles: 24, visibleMeshes: 2 },
        normalization: {
          rotation: [0, 0, 0],
          scale: 1,
          offset: [0, 0, 0],
          size: [2.55, 0.9, 2.3],
          bounds: { min: [-1.275, 0, -1.15], max: [1.275, 0.9, 1.15] },
        },
      };
      const polygon = [
        [0, 0],
        [8, 0],
        [8, 8],
        [0, 8],
      ];
      const floor = {
        ...structuredClone(neutralDemoManifest.floors[0]),
        footprint: polygon,
        rooms: [{ ...neutralDemoManifest.floors[0].rooms[0], polygon, devices: [] }],
        walls: [],
        wallJunctions: [],
        openings: [],
        ceilings: [],
        hedges: [],
        pools: [],
        outdoorPlatforms: [],
      };
      const poseRef = { current: { x: 3, z: 5.2, yaw: 0, pitch: 0 } };
      const movementInputRef = { current: { x: 0, y: 0 } },
        navigationRef = { current: null };
      const props = {
        floor,
        poseRef,
        movementInputRef,
        toolNavigationRef: navigationRef,
        lookInputRef: { current: { x: 0, y: 0 } },
        lookDeltaRef: { current: { x: 0, y: 0 } },
        reducedMotion: true,
        openingPositions: {},
        onOpeningsChange() {},
        onRoomChange() {},
      };
      const render = (asset) =>
        createElement(
          "group",
          null,
          createElement(
            "group",
            { position: [3, 0, 3], userData: { walkCollider: true } },
            createElement(ImportedModelGeometry, { model: { ...model, asset } }),
          ),
          createElement(WalkCameraController, props),
        );
      let renderer;
      try {
        renderer = await create(render(assets[0]));
        assert.equal(
          navigationRef.current.resolveLanding({ x: 3, y: 0, z: 3 }),
          null,
          "loading envelope",
        );
        await act(async () => {
          gates[0].resolve(bytes[0]);
          await leases[0].pending;
        });
        assert.ok(navigationRef.current.resolveLanding({ x: 3, y: 0, z: 3 }), "loaded hollow");
        movementInputRef.current.y = -1;
        await renderer.advanceFrames(60, 1 / 60);
        assert.ok(poseRef.current.z < 4, `walk entered L at ${poseRef.current.z}`);
        movementInputRef.current.y = 0;
        const outside = navigationRef.current.resolveLanding({ x: 3, y: 0, z: 5.2 });
        assert.ok(outside);
        assert.equal(navigationRef.current.teleport(outside, { yaw: 0, pitch: 0 }), true);
        await renderer.update(render(assets[1]));
        await act(async () => {
          gates[1].resolve(bytes[1]);
          await leases[1].pending;
        });
        assert.equal(
          navigationRef.current.resolveLanding({ x: 3, y: 0, z: 3 }),
          null,
          "replacement solid",
        );
        movementInputRef.current.y = -1;
        await renderer.advanceFrames(60, 1 / 60);
        assert.ok(poseRef.current.z > 4.3, `replacement stopped walker at ${poseRef.current.z}`);
      } finally {
        await renderer?.unmount();
        for (const lease of leases) lease.release();
      }
    },
  );
});
