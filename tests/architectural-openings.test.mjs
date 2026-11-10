import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Box3, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { withModules } from "./test-server.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { ArchedSteelGlassPanel, DoorModel, WindowModel } = await load(
    "/packages/catalog/src/architecture/index.ts",
  );
  const engine = await load("/packages/engine/src/index.ts");
  const { ownerHomeProject } = await load("/tests/fixtures/bundled-home.ts");
  test("garden gates cut the wall above the leaf in both wall renderers", () => {
    const wall = {
      id: "garden-wall",
      from: [0, 0],
      to: [4, 0],
      classification: "interior",
      thicknessMeters: 0.16,
      heightMeters: 1.2,
    };
    const gate = engine.doorFromConfiguration(
      { ...engine.DEFAULT_DOOR_CONFIGURATION, variant: "garden-anthracite", heightMeters: 1 },
      1,
      { id: "gate", wallId: wall.id, offsetFromWallStartPlanUnits: 1 },
    );
    const floor = {
      ...engine.neutralDemoManifest.floors[0],
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "inferred" },
      walls: [wall],
      wallJunctions: [],
      rooms: [],
      footprint: [],
      openings: [gate],
    };
    const material = new MeshBasicMaterial({ side: DoubleSide });
    try {
      for (const variant of ["panel", "garden-anthracite"]) {
        const openings = [{ ...gate, variant }];
        const geometries = [
          [engine.buildContinuousWallGeometry(wall, floor, openings)],
          engine
            .buildArchitecturalWallGeometries({ ...floor, openings })
            .map(({ geometry }) => geometry),
        ];
        for (const group of geometries) {
          const meshes = group.map((geometry) => new Mesh(geometry, material));
          const crossesWall = (x) =>
            new Raycaster(new Vector3(x, 1.1, -1), new Vector3(0, 0, 1)).intersectObjects(meshes)
              .length > 0;
          assert.ok(crossesWall(0.5), "the wall remains on either side");
          assert.equal(crossesWall(1.45), variant === "panel");
          for (const geometry of group) geometry.dispose();
        }
      }
    } finally {
      material.dispose();
    }
  });

  test("opening colors survive portable parsing and recolor every door/window family with exact reset", async () => {
    const project = structuredClone(ownerHomeProject);
    const floor = project.floors[0];
    const door = floor.openings.find(
      (opening) => opening.kind === "door" && opening.operation === "hinged",
    );
    const window = floor.openings.find((opening) => opening.kind === "window");
    door.color = window.color = "#325a84";
    const parsed = engine.parseHomeProjectSchema(JSON.parse(JSON.stringify(project)));
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
    window.color = "red";
    assert.equal(engine.parseHomeProjectSchema(project).valid, false);
    delete window.color;
    delete door.color;
    const openings = [
      ...[
        "panel",
        "panel-white-lever",
        "concealed",
        "flush",
        "flush-knob",
        "plank",
        "french",
        "full-glass",
        "steel-arched",
      ].map((variant) => ({ ...door, variant })),
      { ...door, operation: "sliding", variant: "plank" },
      { ...door, operation: "roll-up", variant: "slatted", leafCount: undefined },
      ...["plain", "muntined", "steel-arched"].map((variant) => ({
        ...window,
        variant,
        muntins: variant === "muntined" ? { columns: 2, rows: 2 } : undefined,
      })),
    ];
    for (const opening of openings) {
      const Component = opening.kind === "door" ? DoorModel : WindowModel;
      const props = {
        floor,
        wall: floor.walls.find((wall) => wall.id === opening.wallId),
        opening,
        position: 0,
        reducedMotion: true,
      };
      const renderer = await create(createElement(Component, props));
      const colors = () => {
        const found = [];
        renderer.scene.instance.traverse((object) => {
          if (object.isMesh && object.material?.type === "MeshToonMaterial")
            found.push(object.material.color.getHexString());
        });
        return found.sort();
      };
      const original = colors();
      await renderer.update(
        createElement(Component, { ...props, opening: { ...opening, color: "#325a84" } }),
      );
      assert.ok(colors().includes("325a84"), opening.variant);
      await renderer.update(createElement(Component, props));
      assert.deepEqual(colors(), original, opening.variant);
      await renderer.unmount();
    }
  });

  test("steel arched door and sidelight styles survive portable schema parsing", () => {
    const project = structuredClone(ownerHomeProject);
    const openings = project.floors.flatMap((floor) => floor.openings);
    const door = openings.find((o) => o.kind === "door" && o.operation === "hinged");
    const window = openings.find((o) => o.kind === "window");
    door.variant = "steel-arched";
    window.variant = "steel-arched";
    const result = engine.parseHomeProjectSchema(JSON.parse(JSON.stringify(project)));
    assert.equal(result.valid, true, JSON.stringify(result.issues));
  });
  test("concealed door has no frame and its plain leaf meets either selected wall face", async () => {
    const floor = ownerHomeProject.floors[0];
    const wall = { ...floor.walls[0], from: [0, 0], to: [2, 0], thicknessMeters: 0.15 };
    for (const openingSide of ["left", "right"]) {
      const opening = {
        ...floor.openings.find((o) => o.kind === "door" && o.operation === "hinged"),
        wallId: wall.id,
        variant: "concealed",
        openingSide,
        offsetFromWallStartPlanUnits: 0.4,
        widthPlanUnits: 0.8,
        leafCount: 1,
      };
      const project = structuredClone(ownerHomeProject);
      project.floors[0].openings.find(
        (o) => o.kind === "door" && o.operation === "hinged",
      ).variant = "concealed";
      const parsed = engine.parseHomeProjectSchema(project);
      assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
      const renderer = await create(
        createElement(DoorModel, { floor, wall, opening, position: 0, reducedMotion: true }),
      );
      try {
        const scene = renderer.scene.instance;
        scene.updateMatrixWorld(true);
        const leaf = scene.getObjectByName("concealed-door-leaf");
        assert.ok(leaf);
        const slab = leaf.children[0];
        const box = new Box3().setFromObject(slab);
        const sign = openingSide === "left" ? -1 : 1;
        assert.ok(
          Math.abs((sign === 1 ? box.max.z : box.min.z) - (sign * wall.thicknessMeters) / 2) <
            0.0001,
        );
        assert.equal(scene.getObjectByName("flush-door-pull"), undefined);
        assert.equal(scene.getObjectByName("opening-model-panel"), undefined);
        assert.ok(scene.getObjectByName("opening-door-handles"));
      } finally {
        await renderer.unmount();
      }
    }
  });
  test("steel arch stays inside rectangular door and narrow sidelight envelopes", async () => {
    for (const [width, height] of [
      [0.97, 2.3],
      [0.323, 1.4],
    ]) {
      const renderer = await create(createElement(ArchedSteelGlassPanel, { width, height }));
      try {
        const scene = renderer.scene.instance;
        scene.updateMatrixWorld(true);
        const arch = scene.getObjectByName("steel-arch");
        assert.ok(arch);
        const box = new Box3().setFromObject(arch);
        assert.ok(box.min.x > -width / 2 && box.max.x < width / 2);
        assert.ok(box.min.y > -height / 2 && box.max.y < height / 2);
        assert.ok(box.min.z >= -0.023 && box.max.z <= 0.023);
      } finally {
        await renderer.unmount();
      }
    }
  });
  test("flush closet leaf keeps thin seams, horizontal pulls on either wall face, and normal sliding", async () => {
    const floor = ownerHomeProject.floors[0];
    const wall = { ...floor.walls[0], from: [0, 0], to: [2, 0], thicknessMeters: 0.07 };
    for (const openingSide of ["left", "right"]) {
      const opening = engine.doorFromConfiguration(
        {
          kind: "door",
          operation: "sliding",
          variant: "flush",
          finish: "white",
          leafCount: 1,
          widthMeters: 0.6,
          heightMeters: 2.52,
          openingSide,
          slideDirection: "end",
        },
        1,
        { id: "flush-test", wallId: wall.id, offsetFromWallStartPlanUnits: 0.2 },
      );
      const render = (position) =>
        createElement(DoorModel, {
          wall,
          opening,
          floor: {
            ...floor,
            coordinates: { metersPerPlanUnit: 1, origin: [0, 0], scaleBasis: "measured" },
          },
          position,
          reducedMotion: true,
        });
      const renderer = await create(render(0));
      try {
        const scene = renderer.scene.instance;
        scene.updateMatrixWorld(true);
        const leaf = scene.getObjectByName("flush-door-leaf");
        const pull = scene.getObjectByName("flush-door-pull");
        assert.ok(leaf && pull);
        const bounds = new Box3().setFromObject(leaf);
        assert.ok(Math.abs(bounds.min.y - 0.013) < 0.001);
        assert.ok(Math.abs(bounds.max.x - bounds.min.x - 0.654) < 0.001);
        const pullBounds = new Box3().setFromObject(pull);
        assert.ok(pullBounds.max.x - pullBounds.min.x > 0.3);
        assert.ok(pullBounds.max.y - pullBounds.min.y < 0.02);
        assert.ok(openingSide === "right" ? pullBounds.min.z > 0.035 : pullBounds.max.z < -0.035);
        await renderer.update(render(1));
        await renderer.advanceFrames(2, 1 / 60);
        scene.updateMatrixWorld(true);
        const moved = new Box3().setFromObject(leaf);
        assert.ok(Math.abs(Math.abs(moved.min.x - bounds.min.x) - 0.654) < 0.001);
      } finally {
        await renderer.unmount();
      }
    }
    const project = structuredClone(ownerHomeProject);
    project.floors
      .flatMap((f) => f.openings)
      .find((o) => o.kind === "door" && o.operation === "hinged").variant = "flush";
    const parsed = engine.parseHomeProjectSchema(project);
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
  });
  test("a flush bar front can disable overlay without changing its structural aperture", async () => {
    const floor = ownerHomeProject.floors[0];
    const wall = { ...floor.walls[0], from: [0, 0], to: [2, 0], thicknessMeters: 0.07 };
    const opening = {
      ...floor.openings.find((o) => o.kind === "door"),
      operation: "sliding",
      variant: "flush",
      leafCount: 1,
      wallId: wall.id,
      widthPlanUnits: 0.556,
      offsetFromWallStartPlanUnits: 0.5,
      frontOverlayMeters: 0,
    };
    delete opening.hingeSide;
    const project = structuredClone(ownerHomeProject);
    const door = project.floors[0].openings.find((o) => o.kind === "door");
    door.variant = "flush";
    door.frontOverlayMeters = 0;
    assert.equal(engine.parseHomeProjectSchema(project).valid, true);
    door.frontOverlayMeters = -0.01;
    assert.equal(engine.parseHomeProjectSchema(project).valid, false);
    const renderer = await create(
      createElement(DoorModel, { floor, wall, opening, position: 0, reducedMotion: true }),
    );
    try {
      const scene = renderer.scene.instance;
      scene.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(scene.getObjectByName("flush-door-leaf"));
      assert.ok(Math.abs(bounds.max.x - bounds.min.x - 0.55) < 0.001);
      assert.ok(scene.getObjectByName("flush-door-pull"));
      assert.equal(opening.widthPlanUnits, 0.556);
    } finally {
      await renderer.unmount();
    }
  });
  test("inset knob fronts meet the wall face and concealed face does not reverse the swing", async () => {
    const floor = ownerHomeProject.floors[0],
      wall = { ...floor.walls[0], from: [0, 0], to: [2, 0], thicknessMeters: 0.07 };
    for (const variant of ["flush-knob", "concealed"])
      for (const face of ["left", "right"]) {
        const opening = {
          ...floor.openings.find((o) => o.kind === "door" && o.operation === "hinged"),
          wallId: wall.id,
          variant,
          openingSide: "right",
          leafCount: variant === "flush-knob" ? 2 : 1,
          offsetFromWallStartPlanUnits: 0.4,
          widthPlanUnits: 0.7,
          ...(variant === "concealed"
            ? { frontSide: face }
            : { openingSide: face, frontOverlayMeters: 0 }),
        };
        const project = structuredClone(ownerHomeProject);
        const d = project.floors[0].openings.find((o) => o.kind === "door");
        d.variant = variant;
        if (variant === "concealed") d.frontSide = face;
        else d.frontOverlayMeters = 0;
        assert.equal(engine.parseHomeProjectSchema(project).valid, true);
        const renderer = await create(
          createElement(DoorModel, { floor, wall, opening, position: 0, reducedMotion: true }),
        );
        try {
          const scene = renderer.scene.instance;
          scene.updateMatrixWorld(true);
          const leaf = scene.getObjectByName(
            variant === "concealed" ? "concealed-door-leaf" : "flush-door-leaf",
          );
          const bounds = new Box3().setFromObject(leaf.children[0]);
          assert.ok(Math.abs((face === "right" ? bounds.max.z : -bounds.min.z) - 0.035) < 0.0001);
          if (variant === "concealed")
            assert.equal(engine.resolveOpeningOrientation(opening).sideSign, 1);
        } finally {
          await renderer.unmount();
        }
      }
  });
  test("paired flush knob fronts have two round knobs at their meeting edges", async () => {
    const floor = ownerHomeProject.floors[0];
    const wall = { ...floor.walls[0], from: [0, 0], to: [2, 0], thicknessMeters: 0.07 };
    const opening = engine.doorFromConfiguration(
      {
        kind: "door",
        operation: "sliding",
        variant: "flush-knob",
        finish: "white",
        leafCount: 2,
        widthMeters: 0.75,
        heightMeters: 2.52,
        openingSide: "right",
      },
      1,
      { id: "knob-test", wallId: wall.id, offsetFromWallStartPlanUnits: 0.2 },
    );
    const renderer = await create(
      createElement(DoorModel, {
        wall,
        opening,
        floor: {
          ...floor,
          coordinates: { metersPerPlanUnit: 1, origin: [0, 0], scaleBasis: "measured" },
        },
        position: 0,
        reducedMotion: true,
      }),
    );
    try {
      const scene = renderer.scene.instance;
      scene.updateMatrixWorld(true);
      const knobs = [];
      scene.traverse((o) => {
        if (o.name === "flush-door-knob") knobs.push(o);
      });
      assert.equal(knobs.length, 2);
      assert.equal(scene.getObjectByName("flush-door-pull"), undefined);
      const positions = knobs
        .map((o) => new Box3().setFromObject(o).getCenter(new Vector3()))
        .sort((a, b) => a.x - b.x);
      assert.ok(Math.abs(positions[1].x - positions[0].x - 0.08) < 0.001);
      assert.ok(positions.every((p) => p.z > wall.thicknessMeters / 2));
    } finally {
      await renderer.unmount();
    }
    const project = structuredClone(ownerHomeProject);
    project.floors
      .flatMap((f) => f.openings)
      .find((o) => o.kind === "door" && o.operation === "hinged").variant = "flush-knob";
    assert.equal(engine.parseHomeProjectSchema(project).valid, true);
  });
});
