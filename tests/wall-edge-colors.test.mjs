import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Color, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { wallEdgeFinish } = await load(
    "/packages/engine/src/architecture-geometry/wall-face-finish.ts",
  );
  test("interior Auto edges ignore stale exterior paint when sides differ", () => {
    const wall = {
      classification: "interior",
      exteriorColor: "#ff0000",
      faceColors: { left: "#aabbcc", right: "#334455" },
    };
    assert.equal(wallEdgeFinish(wall, "#112233"), "#112233");
    assert.equal(wallEdgeFinish({ ...wall, edgeColor: "#445566" }, "#112233"), "#445566");
  });
  const { buildArchitecturalWallGeometries } = await load(
    "/packages/engine/src/architecture-geometry.ts",
  );
  const { ArchitecturalWall } = await load(
    "/packages/engine/src/architecture-scene/ArchitecturalWalls.tsx",
  );
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const { createFloorEditorDraft, createFloorEditorHistory, floorEditorReducer } = await load(
    "/packages/engine/src/home-editor/construct/editor-state.ts",
  );
  const { deriveFloorTopology } = await load(
    "/packages/engine/src/home-editor/construct/topology.ts",
  );
  function checkGeometry(geometry, edges, left, right) {
    const normals = geometry.getAttribute("normal"),
      colors = geometry.getAttribute("color");
    let caps = 0;
    for (let index = 0; index < normals.count; index++) {
      const z = normals.getZ(index);
      const edge = Math.abs(z) < 0.999;
      if (edge) caps++;
      const expected = new Color(edge ? edges : z > 0 ? left : right);
      for (const [channel, value] of [
        ["X", expected.r],
        ["Y", expected.g],
        ["Z", expected.b],
      ])
        assert.ok(
          Math.abs(colors[`get${channel}`](index) - value) < 0.000001,
          `vertex ${index}: ${edge ? "cap/reveal" : "face"}`,
        );
    }
    return caps;
  }
  test("Auto and custom edge colors agree across standalone and batched walls with an opening", async () => {
    for (const scenario of [
      { faces: {}, exteriorColor: "#00ff00", edges: "#00ff00" },
      { faces: {}, exteriorColor: "#00ff00", edgeColor: "#334455", edges: "#334455" },
      { faces: { left: "#bcb99b", right: "#bcb99b" }, edges: "#bcb99b" },
      { faces: { left: "#bcb99b", right: "#efece3" }, edges: "#e4e0d8" },
      { faces: { left: "#bcb99b", right: "#efece3" }, edgeColor: "#334455", edges: "#334455" },
    ]) {
      const floor = structuredClone(neutralDemoManifest.floors[0]);
      const wall = {
        id: "painted",
        from: [1, 1],
        to: [3, 1],
        classification: scenario.exteriorColor ? "exterior" : "interior",
        thicknessMeters: 0.2,
        heightMeters: 2.5,
        faceColors: scenario.faces,
        ...(scenario.exteriorColor
          ? { exteriorColor: scenario.exteriorColor, from: [0, 0], to: [4.8, 0] }
          : {}),
        ...(scenario.edgeColor ? { edgeColor: scenario.edgeColor } : {}),
      };
      floor.walls = [wall];
      floor.wallJunctions = [];
      floor.openings = [
        {
          id: "window",
          kind: "window",
          wallId: wall.id,
          offsetFromWallStartPlanUnits: 0.8,
          widthPlanUnits: 0.4,
          openingHeightMeters: 1.2,
          sillHeightMeters: 0.8,
          operation: "fixed",
          variant: "plain",
          panelCount: 1,
          glazing: "clear",
        },
      ];
      const assemblies = buildArchitecturalWallGeometries(floor, "#e4e0d8", "#c97370");
      let batchedCaps = 0;
      for (const { geometry } of assemblies) {
        batchedCaps += checkGeometry(
          geometry,
          scenario.edges,
          scenario.faces.left ?? "#e4e0d8",
          scenario.faces.right ?? scenario.exteriorColor,
        );
        geometry.dispose();
      }
      assert.ok(batchedCaps > 0, "batched caps and reveals verified");
      const renderer = await create(
        createElement(ArchitecturalWall, {
          floor,
          wall,
          openings: floor.openings,
          interiorColor: "#e4e0d8",
          exteriorColor: "#c97370",
          fade: false,
          reducedMotion: true,
        }),
      );
      let checked = 0;
      renderer.scene.instance.traverse((node) => {
        if (node.isMesh && node.geometry.getAttribute("color")) {
          checked += checkGeometry(
            node.geometry,
            scenario.edges,
            scenario.faces.left ?? "#e4e0d8",
            scenario.faces.right ?? scenario.exteriorColor,
          );
        }
      });
      assert.ok(checked > 0);
      await renderer.unmount();
    }
  });
  test("cutaway returns use the authored edge and interior skirting stops at passages", () => {
    const floor = structuredClone(neutralDemoManifest.floors[0]);
    const wall = {
      id: "section",
      from: [1, 1],
      to: [4, 1],
      classification: "interior",
      thicknessMeters: 0.2,
      heightMeters: 2.5,
      edgeColor: "#927257",
      faceColors: { left: "#e6ddcc" },
    };
    floor.walls = [wall];
    floor.wallJunctions = [];
    floor.rooms = [
      {
        ...floor.rooms[0],
        polygon: [
          [0, 1],
          [5, 1],
          [5, 3],
          [0, 3],
        ],
      },
    ];
    floor.openings = [
      {
        id: "tall-passage",
        wallId: wall.id,
        kind: "passage",
        variant: "rectangular",
        offsetFromWallStartPlanUnits: 1,
        widthPlanUnits: 1,
        sillHeightMeters: 0,
        openingHeightMeters: 2.485,
      },
    ];
    for (const sectionEdges of [false, true]) {
      const material = new MeshBasicMaterial();
      const meshes = buildArchitecturalWallGeometries(floor, undefined, undefined, 0, {
        sectionEdges,
        skirting: sectionEdges,
      }).map(({ geometry }) => new Mesh(geometry, material));
      const colorAt = (x, y, inside = true) => {
        const [hit] = new Raycaster(
          new Vector3(x, y, inside ? 2 : 0),
          new Vector3(0, 0, inside ? -1 : 1),
        ).intersectObjects(meshes);
        return hit
          ? new Color()
              .fromBufferAttribute(hit.object.geometry.attributes.color, hit.face.a)
              .getHexString()
          : null;
      };
      assert.equal(colorAt(1.5, 2.4), "e6ddcc");
      assert.equal(colorAt(1.5, 2.48), sectionEdges ? "927257" : "e6ddcc");
      assert.equal(colorAt(2.5, 2.48), null);
      assert.equal(colorAt(2.5, 2.49), sectionEdges ? "927257" : "e6ddcc");
      assert.equal(
        colorAt(1.5, 0.05),
        sectionEdges ? new Color("#e6ddcc").multiplyScalar(0.73).getHexString() : "e6ddcc",
      );
      assert.equal(colorAt(1.5, 0.05, false), colorAt(1.5, 0.5, false));
      assert.equal(colorAt(2.5, 0.05), null);
      meshes.forEach((mesh) => mesh.geometry.dispose());
      material.dispose();
    }
  });
  test("connected cap finishes stay within their walls and conflicting junctions use the general finish", () => {
    const floor = structuredClone(neutralDemoManifest.floors[0]);
    floor.openings = [];
    floor.walls = [
      {
        id: "a",
        from: [1, 1],
        to: [2, 1],
        classification: "interior",
        thicknessMeters: 0.2,
        edgeColor: "#ff0000",
      },
      {
        id: "b",
        from: [2, 1],
        to: [3, 1],
        classification: "interior",
        thicknessMeters: 0.2,
        edgeColor: "#0000ff",
      },
    ];
    floor.wallJunctions = [{ id: "join", at: [2, 1], wallIds: ["a", "b"] }];
    for (const turn of [false, true]) {
      if (turn) floor.walls[1].to = [2, 2];
      const groups = buildArchitecturalWallGeometries(floor);
      const areaByColor = new Map();
      for (const { geometry } of groups) {
        const p = geometry.getAttribute("position"),
          n = geometry.getAttribute("normal"),
          c = geometry.getAttribute("color");
        for (let i = 0; i < geometry.index.count; i += 3) {
          const ids = [0, 1, 2].map((offset) => geometry.index.getX(i + offset));
          if (!ids.every((id) => n.getY(id) > 0.999)) continue;
          const points = ids.map((id) => [p.getX(id), p.getZ(id)]);
          const center = [0, 1].map(
            (axis) => points.reduce((sum, point) => sum + point[axis], 0) / 3,
          );
          const shared = turn
            ? center[0] >= 1.9 && center[1] <= 1.1
            : Math.abs(center[0] - 2) < 0.01201;
          const expected = new Color(
            shared ? "#e4e0d8" : center[0] < (turn ? 1.9 : 2) ? "#ff0000" : "#0000ff",
          );
          assert.ok(
            ids.every(
              (id) =>
                Math.abs(c.getX(id) - expected.r) < 1e-6 &&
                Math.abs(c.getY(id) - expected.g) < 1e-6 &&
                Math.abs(c.getZ(id) - expected.b) < 1e-6,
            ),
            JSON.stringify({
              turn,
              points,
              center,
              actual: [c.getX(ids[0]), c.getY(ids[0]), c.getZ(ids[0])],
            }),
          );
          if (!shared)
            assert.ok(
              points.every(([x, z]) =>
                turn
                  ? expected.r === 1
                    ? x <= 1.90001
                    : z >= 1.09999
                  : expected.r === 1
                    ? x <= 2.00001
                    : x >= 1.99999,
              ),
              "no triangle crosses a finish boundary",
            );
          const [[ax, az], [bx, bz], [cx, cz]] = points;
          const area = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / 2;
          const key = expected.getHexString();
          areaByColor.set(key, (areaByColor.get(key) ?? 0) + area);
        }
        geometry.dispose();
      }
      assert.ok(areaByColor.get("ff0000") > 0.17);
      assert.ok(areaByColor.get("0000ff") > 0.17);
      if (turn)
        assert.ok(areaByColor.get("e4e0d8") > 0.03, "shared corner retains the general finish");
    }
  });
  test("custom edge metadata survives topology and undo/redo and Auto clears it", () => {
    const floor = structuredClone(neutralDemoManifest.floors[0]);
    floor.walls[0].edgeColor = "#334455";
    let history = createFloorEditorHistory(createFloorEditorDraft(floor));
    const id = floor.walls[0].id;
    assert.equal(history.present.walls.find((w) => w.id === id).edgeColor, "#334455");
    assert.equal(
      deriveFloorTopology(history.present).floor.walls.find((w) => w.id === id).edgeColor,
      "#334455",
    );
    history = floorEditorReducer(history, {
      type: "update-wall-metadata",
      wallId: id,
      changes: { edgeColor: undefined },
    });
    assert.equal(history.present.walls.find((w) => w.id === id).edgeColor, undefined);
    assert.equal(
      JSON.parse(JSON.stringify(deriveFloorTopology(history.present).floor)).walls.find(
        (w) => w.id === id,
      ).edgeColor,
      undefined,
    );
    history = floorEditorReducer(history, { type: "undo" });
    assert.equal(history.present.walls.find((w) => w.id === id).edgeColor, "#334455");
    history = floorEditorReducer(history, { type: "redo" });
    assert.equal(history.present.walls.find((w) => w.id === id).edgeColor, undefined);
  });
});
