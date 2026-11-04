import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { create } from "@react-three/test-renderer";
import { BoxGeometry, Mesh, MeshToonMaterial, OrthographicCamera, Vector3 } from "three";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { OrbitCamera } = await load("/packages/engine/src/OrbitCamera.tsx");
  const { RoomNavigation } = await load("/packages/engine/src/room-navigation/RoomNavigation.tsx");
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const { roomCameraFraming } = await load(
    "/packages/engine/src/room-navigation/room-camera-framing.ts",
  );
  const { roomSurfaceEmphasis, wallFaceRoomIds } = await load(
    "/packages/engine/src/room-navigation/room-surface-emphasis.ts",
  );
  const { buildArchitecturalWallGeometries } = await load(
    "/packages/engine/src/architecture-geometry.ts",
  );
  const { RoomWallEmphasis } = await load(
    "/packages/engine/src/room-navigation/RoomWallEmphasis.tsx",
  );
  const { SceneRoomSelection } = await load(
    "/packages/engine/src/building/RoomSelectionSurfaces.tsx",
  );
  const { SceneToonBatcher } = await load(
    "/packages/engine/src/scene-batching/SceneToonBatcher.ts",
  );
  const { planPointToWorld } = await load("/packages/engine/src/geometry.ts");
  const floor = neutralDemoManifest.floors[0];
  const room = floor.rooms[0];
  const options = {
    width: 1200,
    height: 900,
    beforeReturn(canvas) {
      canvas.ownerDocument = { addEventListener() {}, removeEventListener() {} };
    },
  };
  const frame = { left: 22, top: 156, width: 720, height: 620 };
  const controlsFor = (renderer) =>
    renderer.scene.find(
      (node) => node.instance?.target && node.instance?.object?.isOrthographicCamera,
    ).instance;
  const pose = (controls) => [
    ...controls.object.position.toArray(),
    ...controls.target.toArray(),
    controls.object.zoom,
  ];
  const close = (actual, expected, tolerance = 0.001) =>
    actual.forEach((value, index) =>
      assert.ok(Math.abs(value - expected[index]) < tolerance, `${value} vs ${expected[index]}`),
    );
  const tick = async (renderer, count = 100) => {
    await act(async () => {
      await renderer.advanceFrames(count, 1 / 60);
    });
  };

  test("room framing fits tall and wide rooms inside the unobscured desktop/mobile region at one angle", () => {
    const orientations = [];
    for (const [width, height, slot] of [
      [1440, 960, { left: 22, top: 156, width: 850, height: 680 }],
      [390, 844, { left: 12, top: 141, width: 366, height: 302 }],
      [844, 390, { left: 12, top: 130, width: 474, height: 242 }],
    ]) {
      for (const polygon of [
        room.polygon,
        [
          [0, 0],
          [30, 0],
          [30, 2],
          [0, 2],
        ],
        [
          [0, 0],
          [2, 0],
          [2, 30],
          [0, 30],
        ],
      ]) {
        const target = roomCameraFraming(floor, { ...room, polygon }, 3.2, { width, height }, slot);
        orientations.push([target.offset.phi, target.offset.theta]);
        const camera = new OrthographicCamera(
          -width / 2,
          width / 2,
          height / 2,
          -height / 2,
          0.1,
          150,
        );
        camera.position.copy(target.target).add(new Vector3().setFromSpherical(target.offset));
        camera.lookAt(target.target);
        camera.zoom = target.zoom;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        for (const point of polygon) {
          const [x, z] = planPointToWorld(point, floor.coordinates);
          for (const y of [3.2, 3.2 + floor.defaultWallHeightMeters]) {
            const projected = new Vector3(x, y, z).project(camera);
            const sx = ((projected.x + 1) * width) / 2;
            const sy = ((1 - projected.y) * height) / 2;
            assert.ok(sx > slot.left && sx < slot.left + slot.width, `horizontal fit: ${sx}`);
            assert.ok(sy > slot.top && sy < slot.top + slot.height, `vertical fit: ${sy}`);
          }
        }
      }
    }
    orientations.forEach((angle) => assert.deepEqual(angle, orientations[0]));
  });

  test("room selection glides without remounting, retargets mid-flight, and restores the default overview", async () => {
    const props = { floor, resetKey: 0, roomFrame: frame };
    const renderer = await create(createElement(OrbitCamera, props), options);
    try {
      const controls = controlsFor(renderer);
      const initial = pose(controls);
      controls.object.position.x += 2;
      controls.target.x += 2;
      controls.object.zoom = 8;
      controls.update();
      const before = pose(controls);
      await renderer.update(createElement(OrbitCamera, { ...props, room }));
      assert.equal(controlsFor(renderer), controls);
      close(pose(controls), before);
      await tick(renderer, 8);
      const during = pose(controls);
      assert.notDeepEqual(during, before);
      const second = {
        ...room,
        id: "second",
        polygon: room.polygon.map(([x, y]) => [x * 0.25 + 5, y * 0.25 + 2]),
      };
      await renderer.update(createElement(OrbitCamera, { ...props, room: second }));
      close(pose(controls), during, 0.000001);
      await tick(renderer, 180);
      const destination = roomCameraFraming(floor, second, 0, options, frame);
      close(controls.target.toArray(), destination.target.toArray());
      assert.ok(Math.abs(controls.object.zoom - destination.zoom) < 0.001);
      await renderer.update(createElement(OrbitCamera, props));
      await tick(renderer, 180);
      close(pose(controls), initial);
      assert.equal(controls.enableDamping, true);
      controls.object.zoom = 10;
      await renderer.update(createElement(OrbitCamera, { ...props, roomRequestKey: 1 }));
      await tick(renderer, 180);
      close(pose(controls), initial);
    } finally {
      await renderer.unmount();
    }
  });

  test("opening directly into a saved room still returns to the normal floor overview", async () => {
    const props = { floor, resetKey: 0, roomFrame: frame, reducedMotion: true };
    const baseline = await create(createElement(OrbitCamera, props), options);
    const expected = pose(controlsFor(baseline));
    await baseline.unmount();
    const renderer = await create(createElement(OrbitCamera, { ...props, room }), options);
    try {
      const controls = controlsFor(renderer);
      assert.notDeepEqual(pose(controls), expected);
      await renderer.update(createElement(OrbitCamera, props));
      close(pose(controls), expected);
    } finally {
      await renderer.unmount();
    }
  });

  test("manual camera gestures interrupt a glide; a repeated room request reframes; reduced motion settles immediately", async () => {
    const props = { floor, resetKey: 0, roomFrame: frame };
    const renderer = await create(createElement(OrbitCamera, props), options);
    try {
      const controls = controlsFor(renderer);
      await renderer.update(createElement(OrbitCamera, { ...props, room }));
      await tick(renderer, 8);
      controls.dispatchEvent({ type: "start" });
      const stopped = pose(controls);
      // Rendering current floor metadata again must not restart an interrupted glide.
      await renderer.update(
        createElement(OrbitCamera, { ...props, room, buildingFloors: [{ ...floor }] }),
      );
      await tick(renderer, 20);
      close(pose(controls), stopped);
      await renderer.update(createElement(OrbitCamera, { ...props, room, roomRequestKey: 1 }));
      await tick(renderer, 180);
      assert.notDeepEqual(pose(controls), stopped);
      const second = { ...room, id: "second", polygon: room.polygon.map(([x, y]) => [x - 4, y]) };
      await renderer.update(
        createElement(OrbitCamera, { ...props, room: second, reducedMotion: true }),
      );
      const destination = roomCameraFraming(floor, second, 0, options, frame);
      close(controls.target.toArray(), destination.target.toArray());
      const settled = pose(controls);
      await tick(renderer, 10);
      close(pose(controls), settled);
      await renderer.update(createElement(OrbitCamera, { ...props, showRoof: true }));
      await tick(renderer, 180);
      close(pose(controls), settled, 0.000001);
    } finally {
      await renderer.unmount();
    }
  });

  test("a refreshed selected room does not override the user's camera after the initial focus", async () => {
    const props = { floor, resetKey: 0, roomFrame: frame, reducedMotion: true };
    const renderer = await create(createElement(OrbitCamera, { ...props, room }), options);
    try {
      const controls = controlsFor(renderer);
      controls.object.position.x += 2;
      controls.target.x += 2;
      controls.object.zoom = 8;
      controls.update();
      const userPose = pose(controls);

      await renderer.update(
        createElement(OrbitCamera, {
          ...props,
          floor: { ...floor },
          room: { ...room },
          roomFrame: { ...frame },
        }),
      );

      close(pose(controls), userPose, 0.000001);
    } finally {
      await renderer.unmount();
    }
  });

  test("wall emphasis assigns interior faces to rooms without changing geometry or scene lighting", () => {
    const groups = buildArchitecturalWallGeometries(floor);
    try {
      const assigned = groups.flatMap(({ geometry }) => wallFaceRoomIds(geometry, floor));
      assert.ok(assigned.includes(room.id));
      assert.ok(assigned.includes(null), "external faces do not borrow interior ownership");
      assert.equal(roomSurfaceEmphasis(false, room.id, room.id), 1);
      assert.ok(
        roomSurfaceEmphasis(true, room.id, room.id) > roomSurfaceEmphasis(true, null, room.id),
      );
      assert.ok(
        roomSurfaceEmphasis(true, room.id, "other") < roomSurfaceEmphasis(true, null, "other"),
      );
    } finally {
      groups.forEach(({ geometry }) => geometry.dispose());
    }
  });

  test("room focus animates submitted wall colors without repacking static batches every frame", async () => {
    const groups = buildArchitecturalWallGeometries(floor);
    const walls = groups.map(
      ({ geometry }) => new Mesh(geometry, new MeshToonMaterial({ vertexColors: true })),
    );
    walls.forEach((mesh) => {
      mesh.castShadow = true;
    });
    const stableGeometry = new BoxGeometry();
    const stable = [
      new Mesh(stableGeometry, new MeshToonMaterial()),
      new Mesh(stableGeometry, new MeshToonMaterial()),
    ];
    const tree = (selectedId) =>
      createElement(
        SceneRoomSelection.Provider,
        { value: selectedId },
        ...walls.map((mesh, index) =>
          createElement(
            "primitive",
            { key: index, object: mesh },
            createElement(RoomWallEmphasis, {
              geometry: mesh.geometry,
              floor,
              enabled: true,
              reducedMotion: false,
            }),
          ),
        ),
        ...stable.map((mesh, index) =>
          createElement("primitive", { key: `stable-${index}`, object: mesh }),
        ),
      );
    const renderer = await create(tree(null), options);
    const batcher = new SceneToonBatcher();
    const camera = new OrthographicCamera();
    const wallBuffers = new Set(),
      stableBuffers = new Set(),
      submittedColors = [];
    const draw = {
      extensions: { has: () => true },
      localClippingEnabled: false,
      clippingPlanes: [],
      render(scene) {
        const batches = scene.children.filter((object) => object.isBatchedMesh);
        const stableBatch = batches.find((batch) => !batch.castShadow);
        assert.ok(stableBatch, "unrelated static meshes retain batching");
        stableBuffers.add(stableBatch.geometry);
        const wallBatch = batches.find((batch) => batch.castShadow);
        if (wallBatch) wallBuffers.add(wallBatch.geometry);
        const source = walls[0];
        const actual = source.layers.test(camera.layers)
          ? source.geometry.getAttribute("color").getX(0)
          : wallBatch.geometry.getAttribute("color").getX(0);
        const expected = source.geometry.getAttribute("color").getX(0);
        assert.ok(Math.abs(actual - expected) < 1e-6, "submitted colors follow the emphasis");
        submittedColors.push(actual);
      },
    };
    const render = () => batcher.render(draw, renderer.scene.instance, camera);
    try {
      await tick(renderer, 60);
      render();
      const overview = submittedColors.at(-1);
      await renderer.update(tree(room.id));
      for (let frame = 0; frame < 60; frame++) {
        await tick(renderer, 1);
        render();
      }
      assert.notEqual(submittedColors[1], overview, "focus begins animating the visible colors");
      assert.notEqual(submittedColors[1], submittedColors.at(-1), "emphasis animates over time");
      assert.equal(stableBuffers.size, 1, "unrelated furniture retains its GPU buffers");
      assert.ok(wallBuffers.size <= 2, `room focus created ${wallBuffers.size} wall batches`);
    } finally {
      batcher.dispose();
      await renderer.unmount();
      groups.forEach(({ geometry }) => geometry.dispose());
      stableGeometry.dispose();
      [...walls, ...stable].forEach((mesh) => mesh.material.dispose());
    }
  });

  test("room pills use resolved names, support selection and overview, and update with the active floor", async () => {
    await withStorageDom(async ({ document, window, click }) => {
      const originalObserver = globalThis.ResizeObserver;
      globalThis.ResizeObserver = class {
        observe() {}
        disconnect() {}
      };
      const root = createRoot(document.body.appendChild(document.createElement("div")));
      const second = { ...room, id: "second", name: "Study" };
      function Harness({ rooms }) {
        const [selectedId, setSelectedId] = useState(null);
        const [level, setLevel] = useState("ground");
        const floors = [
          { id: "ground", name: "Ground floor" },
          { id: "upper", name: "First floor" },
        ];
        const active = floors.find((floor) => floor.id === level);
        return createElement(RoomNavigation, {
          floor: active,
          floors,
          summary: active.name,
          onSelectFloor: (id) => {
            setLevel(id);
            setSelectedId(null);
          },
          rooms: level === "ground" ? rooms : [second],
          names: { [room.id]: "Living room" },
          selectedId,
          onSelect: setSelectedId,
          onOverview: () => setSelectedId(null),
          reducedMotion: true,
        });
      }
      try {
        await act(async () => root.render(createElement(Harness, { rooms: [room, second] })));
        assert.equal(
          document.querySelector("nav").getAttribute("aria-label"),
          "Rooms on this floor",
        );
        assert.equal(
          document.querySelector('[aria-label="Ground floor"]').parentElement,
          [...document.querySelectorAll("button")].find(
            (button) => button.textContent === "Living room",
          ).parentElement,
          "floor summary belongs to the same scrolling row as the rooms",
        );
        await click("Living room");
        assert.equal(document.querySelector('[aria-pressed="true"]').textContent, "Living room");
        await click("Study");
        assert.equal(document.querySelector('[aria-pressed="true"]').textContent, "Study");
        await click("Ground floor");
        assert.equal(document.querySelector('[aria-expanded="true"]').textContent, "Ground floor");
        await click("First floor");
        assert.equal(document.querySelector('[aria-expanded="false"]').textContent, "First floor");
        assert.equal(document.body.textContent.includes("Living room"), false);
        assert.equal(document.querySelector('[aria-label="Choose a floor"]'), null);
        await click("First floor");
        await act(async () =>
          document
            .querySelector('[aria-label="First floor"]')
            .dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
        );
        assert.equal(document.querySelector('[aria-label="Choose a floor"]'), null);
        assert.equal(document.activeElement.getAttribute("aria-label"), "First floor");
        await click("First floor");
        await click("Ground floor");
        await act(async () => root.render(createElement(Harness, { rooms: [second] })));
        assert.equal(document.body.textContent.includes("Living room"), false);
        await act(async () => root.render(createElement(Harness, { rooms: [] })));
        assert.ok(
          document.querySelector('[aria-label="Ground floor"]'),
          "empty floors remain navigable",
        );
      } finally {
        await act(async () => root.unmount());
        if (originalObserver) globalThis.ResizeObserver = originalObserver;
        else delete globalThis.ResizeObserver;
      }
    });
  });
});
