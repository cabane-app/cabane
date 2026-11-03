import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { IDBFactory } from "fake-indexeddb";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const image = JSON.parse(
  await readFile(new URL("./fixtures/wall-image.json", import.meta.url), "utf8"),
);

await withModules(async (load) => {
  const e = await load("/packages/engine/src/index.ts");
  const { layoutFloorFromEditorFloor } = await load("/apps/web/src/editor-preview/project-sync.ts");
  const { splitWallSurfaceGeometry } = await load(
    "/packages/engine/src/architecture-geometry/wall-surface-geometry.ts",
  );
  const { wallFrame } = await load(
    "/packages/engine/src/architecture-geometry/wall-coordinate-frame.ts",
  );
  const { ArchitecturalWall, ArchitecturalWalls } = await load(
    "/packages/engine/src/architecture-scene/ArchitecturalWalls.tsx",
  );
  const { WALL_FADE_MIN_OPACITY } = await load("/packages/engine/src/wall-fade.ts");
  const finish = { pattern: "subway-tile", color: "#237a91", repeatMeters: 1.2 };
  const wallpaper = { pattern: "striped-wallpaper", color: "#a15d72", repeatMeters: 0.8 };
  const custom = { pattern: "custom-image", color: "#ffffff", repeatMeters: 8, image };
  const project = () =>
    e.defineHomeProject({
      schemaVersion: 1,
      seedRevision: "wall-surfaces",
      home: structuredClone(e.neutralDemoManifest.home),
      floor: layoutFloorFromEditorFloor(structuredClone(e.neutralDemoManifest.floors[0])),
      sceneItems: [],
      roomProfiles: {},
      openingProfiles: {},
      shortcuts: [],
      assumptions: [],
    });

  test("wall pattern schema round trips supported finishes and rejects unsafe or unknown input", () => {
    for (const pattern of e.WALL_SURFACE_PATTERNS) {
      const p = project();
      p.floors[0].walls[0].faceFinishes = { left: { ...finish, pattern }, right: wallpaper };
      const parsed = e.parseHomeProjectSchema(JSON.parse(JSON.stringify(p)));
      assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
      assert.deepEqual(
        parsed.project.floors[0].walls[0].faceFinishes,
        p.floors[0].walls[0].faceFinishes,
      );
    }
    for (const invalid of [
      { ...finish, pattern: "remote-image" },
      { ...finish, url: "https://example.test/private.png" },
      { ...finish, color: "url(image)" },
      { ...finish, repeatMeters: 0 },
      { ...finish, repeatMeters: 5.1 },
      { ...finish, repeatMeters: Infinity },
      { ...finish, repeatMeters: "1" },
      null,
    ]) {
      const p = project();
      p.floors[0].walls[0].faceFinishes = { left: invalid };
      assert.equal(e.parseHomeProjectSchema(p).valid, false, JSON.stringify(invalid));
    }
    const p = project();
    p.floors[0].walls[0].faceFinishes = { top: finish };
    assert.equal(e.parseHomeProjectSchema(p).valid, false);
    assert.equal(e.parseHomeProjectSchema(project()).valid, true, "legacy paint remains valid");
  });

  test("wall finishes survive topology, history, publication and reopening in isolated IndexedDB", async () => {
    const p = project(),
      floor = p.floors[0],
      wallId = floor.walls[0].id;
    let history = e.createFloorEditorHistory(e.createFloorEditorDraft(floor));
    history = e.floorEditorReducer(history, {
      type: "update-wall-metadata",
      wallId,
      changes: { faceFinishes: { left: custom, right: wallpaper } },
    });
    const expected = { left: custom, right: wallpaper };
    assert.deepEqual(
      e.deriveFloorTopology(history.present).floor.walls.find((w) => w.id === wallId).faceFinishes,
      expected,
    );
    const undone = e.floorEditorReducer(history, { type: "undo" });
    assert.equal(undone.present.walls.find((w) => w.id === wallId).faceFinishes, undefined);
    history = e.floorEditorReducer(undone, { type: "redo" });
    p.floors[0] = { ...floor, walls: e.deriveFloorTopology(history.present).floor.walls };
    const factory = new IDBFactory();
    const store = e.createIndexedDbProjectRecordStore(factory);
    const repository = e.createHomeProjectRepository(store, {
      furnishingModels: {},
      deviceModels: {},
    });
    const record = e.createSeedProjectRecord(project());
    await store.write(record.homeId, e.serializeHomeProjectRecord(record));
    const saved = await e.autosaveHomeProjectDraft(repository, record, p);
    assert.equal(saved.status, "saved", JSON.stringify(saved));
    const applied = await e.publishHomeProject(repository, saved.record);
    assert.equal(applied.status, "published", JSON.stringify(applied));
    const reopened = await e
      .createHomeProjectRepository(e.createIndexedDbProjectRecordStore(factory), {
        furnishingModels: {},
        deviceModels: {},
      })
      .load(record.homeId);
    for (const state of ["draft", "published"])
      assert.deepEqual(
        reopened[state].floors[0].walls.find((w) => w.id === wallId).faceFinishes,
        expected,
      );
    assert.deepEqual(
      e.createFloorEditorDraft(reopened.draft.floors[0]).walls.find((w) => w.id === wallId)
        .faceFinishes,
      expected,
    );
  });

  test("custom wall images round trip embedded bytes and reject unsafe or inconsistent image metadata", () => {
    const p = project();
    p.floors[0].walls[0].faceFinishes = { left: custom };
    const parsed = e.parseHomeProjectSchema(JSON.parse(JSON.stringify(p)));
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
    assert.deepEqual(parsed.project.floors[0].walls[0].faceFinishes.left, custom);
    assert.equal(e.wallSurfaceRepeatHeight(custom), 4, "vertical repeat preserves the image ratio");
    for (const invalid of [
      { ...custom, color: "#ff0000" },
      { ...custom, repeatMeters: 20.1 },
      { ...custom, image: undefined },
      ...[
        { ...image, dataUrl: "https://example.test/wall.jpg" },
        { ...image, dataUrl: "data:image/svg+xml;base64,PHN2Zy8+" },
        { ...image, dataUrl: "data:image/jpeg;base64,not-a-jpeg" },
        { ...image, dataUrl: "data:image/jpeg;base64,AAAA" },
        {
          ...image,
          dataUrl: `data:image/jpeg;base64,${"A".repeat(4 * Math.ceil(e.WALL_IMAGE_LIMITS.storedBytes / 3) + 4)}`,
        },
        { ...image, width: image.width + 1 },
        { ...image, height: 0 },
        { ...image, width: 1025 },
        { ...image, name: "" },
        { ...image, url: "https://example.test/wall.jpg" },
      ].map((image) => ({ ...custom, image })),
    ]) {
      p.floors[0].walls[0].faceFinishes = { left: invalid };
      assert.equal(e.parseHomeProjectSchema(p).valid, false);
    }
  });

  test("changing wall finishes preserves settled fading in both renderers", async () => {
    const floor = structuredClone(e.neutralDemoManifest.floors[0]);
    floor.coordinates = { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" };
    floor.footprint = [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ];
    delete floor.footprintRegions;
    floor.wallJunctions = [];
    floor.openings = [];
    const wall = {
      id: "fading-wall",
      from: [0, 0],
      to: [4, 0],
      classification: "exterior",
      thicknessMeters: 0.2,
      heightMeters: 2.5,
    };
    for (const Component of [ArchitecturalWall, ArchitecturalWalls]) {
      const view = (currentWall) =>
        createElement(Component, {
          floor: { ...floor, walls: [currentWall] },
          wall: currentWall,
          openings: [],
          interiorColor: "#eeeeee",
          exteriorColor: "#cccccc",
          fade: true,
          reducedMotion: true,
        });
      const renderer = await create(view(wall), { camera: { position: [0, 3, -10] } });
      const assertFaded = () => {
        let meshes = 0;
        renderer.scene.instance.traverse((node) => {
          if (!node.isMesh) return;
          meshes++;
          assert.ok(
            Math.abs(node.material.opacity - WALL_FADE_MIN_OPACITY) < 1e-6,
            `${Component.name}: new surfaces keep the existing wall fade`,
          );
        });
        assert.ok(meshes > 0);
      };
      try {
        await renderer.advanceFrames(2, 1 / 60);
        assertFaded();
        await renderer.update(view({ ...wall, faceFinishes: { left: custom, right: wallpaper } }));
        await renderer.advanceFrames(2, 1 / 60);
        assertFaded();
        await renderer.update(view(wall));
        await renderer.advanceFrames(2, 1 / 60);
        assertFaded();
      } finally {
        await renderer.unmount();
      }
    }
  });

  test("standalone wall images retain junction-trimmed geometry and read outward on both faces", async () => {
    const { Float32BufferAttribute } = await import("three");
    const floor = structuredClone(e.neutralDemoManifest.floors[0]);
    const wall = floor.walls[0];
    const source = e.buildContinuousWallGeometry(wall, floor, floor.openings);
    source.setAttribute(
      "color",
      new Float32BufferAttribute(new Array(source.getAttribute("position").count * 3).fill(0.5), 3),
    );
    const original = Array.from(source.getAttribute("position").array);
    wall.faceFinishes = { left: custom, right: custom };
    const surfaces = splitWallSurfaceGeometry(source, wall, floor);
    const triples = (array) =>
      Array.from({ length: array.length / 9 }, (_, i) =>
        array.slice(i * 9, i * 9 + 9).join(":"),
      ).sort();
    assert.deepEqual(
      triples(surfaces.flatMap((s) => Array.from(s.geometry.getAttribute("position").array))),
      triples(original),
    );
    assert.ok(surfaces.some((s) => s.finish));
    const frame = wallFrame(wall, floor);
    for (const surface of surfaces.filter((s) => s.finish)) {
      const positions = surface.geometry.getAttribute("position");
      const normals = surface.geometry.getAttribute("normal");
      const uv = surface.geometry.getAttribute("uv");
      for (let i = 0; i < positions.count; i++) {
        const side = normals.getX(i) * frame.normal[0] + normals.getZ(i) * frame.normal[1];
        const distance =
          (positions.getX(i) - frame.from[0]) * frame.direction[0] +
          (positions.getZ(i) - frame.from[1]) * frame.direction[1];
        assert.ok(
          Math.abs(uv.getX(i) - (side < 0 ? -distance : distance) / custom.repeatMeters) < 1e-5,
          "asymmetric images read left to right from either room",
        );
        assert.ok(
          Math.abs(uv.getY(i) - positions.getY(i) / e.wallSurfaceRepeatHeight(surface.finish)) <
            1e-5,
        );
      }
    }
    surfaces.forEach((s) => s.geometry.dispose());
  });

  test("pattern UVs keep physical scale across openings on rotated walls without changing geometry", () => {
    for (const imageSide of ["left", "right"])
      for (const angle of [0, Math.PI / 4, Math.PI / 2]) {
        const floor = structuredClone(e.neutralDemoManifest.floors[0]);
        floor.coordinates = { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" };
        const dx = Math.cos(angle),
          dz = Math.sin(angle);
        const wall = {
          id: "surface-wall",
          from: [1, 1],
          to: [1 + dx * 4, 1 + dz * 4],
          classification: "interior",
          thicknessMeters: 0.2,
          heightMeters: 2.5,
        };
        floor.walls = [wall];
        floor.wallJunctions = [];
        floor.openings = [
          {
            id: "surface-window",
            kind: "window",
            wallId: wall.id,
            offsetFromWallStartPlanUnits: 1,
            widthPlanUnits: 1,
            openingHeightMeters: 1,
            sillHeightMeters: 0.8,
            operation: "fixed",
            variant: "plain",
            panelCount: 1,
            glazing: "clear",
          },
        ];
        const plain = e.buildArchitecturalWallGeometries(floor);
        wall.faceFinishes =
          imageSide === "left"
            ? { left: custom, right: wallpaper }
            : { left: wallpaper, right: custom };
        const groups = e.buildArchitecturalWallGeometries(floor);
        assert.equal(
          groups.reduce((n, g) => n + g.geometry.index.count, 0),
          plain.reduce((n, g) => n + g.geometry.index.count, 0),
          "same triangles and cutouts",
        );
        const patterned = groups.filter((g) => g.finish);
        assert.equal(patterned.length, 2);
        for (const { geometry, finish: surface } of patterned) {
          const p = geometry.getAttribute("position"),
            n = geometry.getAttribute("normal"),
            uv = geometry.getAttribute("uv");
          for (let i = 0; i < p.count; i++) {
            assert.ok(Math.abs(n.getY(i)) < 1e-6, "no patterns on caps");
            assert.ok(
              Math.abs(Math.abs(n.getX(i) * -dz + n.getZ(i) * dx) - 1) < 1e-5,
              "no patterns on reveals",
            );
            assert.ok(
              Math.abs(
                uv.getX(i) -
                  (((p.getX(i) - 1) * dx + (p.getZ(i) - 1) * dz) / surface.repeatMeters) *
                    (surface.pattern === "custom-image" && n.getX(i) * -dz + n.getZ(i) * dx < 0
                      ? -1
                      : 1),
              ) < 1e-5,
              "custom images face the viewer on either side of a rotated wall",
            );
            assert.ok(Math.abs(uv.getY(i) - p.getY(i) / e.wallSurfaceRepeatHeight(surface)) < 1e-5);
          }
        }
        const meshes = groups.map((g) => new Mesh(g.geometry, new MeshBasicMaterial()));
        const ray = new Raycaster(
          new Vector3(1 + 1.5 * dx - dz, 1.2, 1 + 1.5 * dz + dx),
          new Vector3(dz, 0, -dx),
        );
        assert.equal(
          ray.intersectObjects(meshes).length,
          0,
          "window stays open through both faces",
        );
        for (const g of [...plain, ...groups]) g.geometry.dispose();
        meshes.forEach((m) => m.material.dispose());
      }
  });
});
