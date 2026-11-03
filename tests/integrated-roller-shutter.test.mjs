import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { Box3, Vector3 } from "three";
import { withModules } from "./test-server.mjs";
import { connectedRuntimeFixture } from "./fixtures/home-assistant.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const e = await load("/packages/engine/src/index.ts");
  const { outsideRoomDevices } = await load("/packages/engine/src/outside-room-devices.ts");
  const catalog = await load("/packages/catalog/src/device/index.ts");
  const architecture = await load("/packages/catalog/src/architecture/index.ts");
  const { layoutFixtureManifest } = await load("/tests/fixtures/agent-home.tsx");
  const { windowPlacements } = await load(
    "/apps/web/src/editor-preview/furnish/placement/window-placement.ts",
  );
  const { catalogEntries, filterCatalog } = await load(
    "/apps/web/src/editor-preview/furnish/catalog/catalog.ts",
  );
  const { catalogStartPlacement } = await load(
    "/apps/web/src/editor-preview/furnish/placement/catalog-start-placement.ts",
  );
  const { createCatalogItem } = await load(
    "/apps/web/src/editor-preview/furnish/placement/item-creation.ts",
  );
  const { furnishingEditorReducer, createFurnishingEditorState, placementForWorldDrag } =
    await load("/apps/web/src/editor-preview/furnish/editor-state.ts");
  const { ArrangePlacedItems } = await load(
    "/apps/web/src/editor-preview/furnish/ArrangePlacedItems.tsx",
  );
  const { ShortcutPicker } = await load("/apps/web/src/editor-action-bar/ShortcutPicker.tsx");
  const { resolveActionBarDestination } = await load(
    "/packages/engine/src/action-bar/action-bar-navigation.ts",
  );
  const { statesBySlotIdForRoom } = await load(
    "/packages/engine/src/architecture-scene/RoomFurnishings.tsx",
  );
  const { composeOwnerProjectManifest } = await load("/apps/web/src/project-runtime.ts");
  const definition = catalog.stableDeviceRegistry["integrated-roller-shutter"];
  const registries = {
    deviceModels: catalog.stableDeviceRegistry,
    furnishingModels: {},
    openingModels: {},
  };
  const entry = catalogEntries({}, registries.deviceModels).find(
    (entry) => entry.modelId === "integrated-roller-shutter",
  );
  const fixture = () => {
    const floor = structuredClone(layoutFixtureManifest.floors[0]);
    floor.openings = floor.openings.filter((opening) => opening.kind === "window");
    const candidate = catalogStartPlacement(entry, floor, [2.7, 1]);
    assert.ok(candidate.placement, candidate.error);
    const item = {
      ...createCatalogItem(entry, candidate.placement, [], [], floor.id),
      size: candidate.size,
    };
    const project = e.createEmptyHomeProject("shutter-fixture", "Shutter fixture");
    project.floors = [floor];
    project.sceneItems = [item];
    return { floor, item, project };
  };
  const coverState = (position, extra = {}) => ({
    entityId: "cover.demo_shade",
    state: position === 0 ? "closed" : "open",
    attributes: { current_position: position },
    available: true,
    stale: false,
    ...extra,
  });
  const props = (position) => ({
    state: coverState(position),
    visualState: "connected-active",
    reducedMotion: true,
    walkMode: false,
    onInteract() {},
  });

  test("the shutter exposes bounded toon geometry and keeps full-size slats at every pose", async (t) => {
    assert.equal(filterCatalog([entry], "living-room", "roller shutter")[0], entry);
    assert.deepEqual(definition.defaultSize, [1.2, 1.6, 0.04]);
    assert.equal(definition.component, catalog.IntegratedRollerShutterModel);
    for (const scale of [
      [1, 1, 1],
      [0.5, 1.4, 1],
      [2, 0.6, 1],
    ]) {
      const renderer = await create(
        createElement("group", { scale }, createElement(definition.component, props(0))),
      );
      const geometries = renderer.scene
        .findAll((node) => node.type === "Mesh")
        .map((node) => node.instance.geometry);
      for (const position of [0, 25, 50, 100]) {
        await renderer.update(
          createElement("group", { scale }, createElement(definition.component, props(position))),
        );
        const bounds = new Box3().setFromObject(renderer.scene.instance);
        const size = bounds.getSize(new Vector3()).toArray();
        size.forEach((extent, axis) =>
          assert.ok(Math.abs(extent - definition.defaultSize[axis] * scale[axis]) < 0.001),
        );
        assert.ok(Math.abs(bounds.min.y) < 0.001);
        const meshes = renderer.scene.findAll((node) => node.type === "Mesh");
        assert.ok(meshes.length <= definition.complexity.visibleMeshes);
        let triangles = 0;
        meshes.forEach((node, index) => {
          const mesh = node.instance;
          assert.equal(mesh.material.type, "MeshToonMaterial");
          assert.equal(mesh.geometry, geometries[index], "animation must reuse mounted geometry");
          triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
        });
        assert.ok(triangles <= definition.complexity.triangles, `${triangles} triangles`);
        if (position === 0 && scale[0] === 1)
          t.diagnostic(`Nominal shutter: ${meshes.length} solid meshes, ${triangles} triangles.`);
        for (const slat of renderer.scene.findByProps({ name: "shutter-slats" }).instance.children)
          assert.deepEqual(slat.scale.toArray(), [1, 1, 1]);
      }
      await renderer.unmount();
    }
  });

  test("slats roll smoothly in both directions, retarget without jumping, and freeze on signal loss", async () => {
    const element = (position, reducedMotion = false, extra = {}) =>
      createElement(definition.component, { ...props(position), reducedMotion, ...extra });
    const renderer = await create(element(0));
    const rail = () =>
      renderer.scene.findByProps({ name: "shutter-bottom-rail" }).instance.position.y;
    const bottom = rail();
    await renderer.update(element(100));
    assert.equal(rail(), bottom, "new target starts at the mounted pose");
    await renderer.advanceFrames(2, 0.016);
    assert.ok(rail() > bottom && rail() < 1.525);
    const moving = rail();
    await renderer.update(element(0));
    assert.equal(rail(), moving);
    await renderer.advanceFrames(2, 0.016);
    assert.ok(rail() < moving && rail() > bottom);
    for (const extra of [
      { visualState: "unavailable" },
      { visualState: "disconnected" },
      { state: coverState(100, { stale: true }) },
      { state: coverState(100, { state: "opening", attributes: {} }) },
    ]) {
      const frozen = rail();
      await renderer.update(element(100, false, extra));
      await renderer.advanceFrames(10, 0.016);
      assert.equal(rail(), frozen);
    }
    await renderer.update(element(100, true));
    assert.ok(Math.abs(rail() - 1.525) < 1e-8);
    await renderer.update(element(0, true));
    assert.equal(rail(), bottom);
    await renderer.unmount();
  });

  test("exterior fitting clears the closed window and slider geometry on thin and thick reversed walls", async () => {
    const original = fixture().floor;
    const sourceWindow = original.openings[0];
    const framePositions = new Map();
    for (const thickness of [0.08, 0.2, 0.4, 0.9]) {
      for (const reversed of [false, true]) {
        for (const kind of [
          "clear",
          "clear-double",
          "privacy",
          "privacy-double",
          "outward",
          "privacy-outward",
          "arched",
          "slider",
          "slider-single",
        ]) {
          const floor = structuredClone(original);
          const wall = floor.walls.find((wall) => wall.id === sourceWindow.wallId);
          wall.thicknessMeters = thickness;
          // The top room finish follows the physical face for every thickness.
          for (const room of floor.rooms)
            room.polygon = room.polygon.map(([x, z]) => [x, z === 0.12 ? thickness / 2 + 0.02 : z]);
          const opening = kind.startsWith("slider")
            ? {
                id: sourceWindow.id,
                wallId: wall.id,
                kind: "door",
                operation: "sliding",
                variant: "full-glass",
                finish: "white",
                leafCount: kind === "slider-single" ? 1 : 2,
                offsetFromWallStartPlanUnits: 1.8,
                widthPlanUnits: 1.8,
                openingHeightMeters: 2.1,
                sillHeightMeters: 0,
              }
            : {
                ...sourceWindow,
                panelCount: kind.endsWith("-double") ? 2 : sourceWindow.panelCount,
                glazing: kind.startsWith("privacy") ? "privacy" : "clear",
                variant: kind === "arched" ? "steel-arched" : "plain",
                openingSide: kind.includes("outward") ? "left" : "right",
              };
          floor.openings = [opening];
          if (reversed) {
            [wall.from, wall.to] = [wall.to, wall.from];
            opening.offsetFromWallStartPlanUnits =
              8 - opening.offsetFromWallStartPlanUnits - opening.widthPlanUnits;
            opening.openingSide = opening.openingSide === "left" ? "right" : "left";
          }
          const candidates = windowPlacements(definition, floor, [2.7, 1]);
          assert.equal(candidates.length, 1, `${thickness}/${reversed}/${kind}`);
          const candidate = candidates[0];
          const transform = e.resolveItemTransform(candidate.placement, floor);
          assert.ok(transform.position[2] < 0, "physical placement remains on the exterior side");
          const frameKey = `${reversed}/${kind}`;
          if (!framePositions.has(frameKey)) framePositions.set(frameKey, transform.position[2]);
          assert.equal(
            transform.position[2],
            framePositions.get(frameKey),
            "the integrated shutter stays beside the window frame regardless of wall thickness",
          );
          assert.equal(
            e.roomIdForItem(
              { ...fixture().item, placement: candidate.placement },
              floor,
              definition,
            ),
            "fixture-studio",
          );
          const renderer = await create(
            createElement(
              "group",
              null,
              createElement(
                opening.kind === "window" ? architecture.WindowModel : architecture.DoorModel,
                { opening, wall, floor, position: 0, reducedMotion: true },
              ),
              createElement(
                "group",
                {
                  name: "mounted-shutter",
                  position: transform.position,
                  rotation: [0, transform.rotationYRadians, 0],
                  scale: candidate.size.map((value, axis) => value / definition.defaultSize[axis]),
                },
                createElement(definition.component, props(0)),
              ),
            ),
          );
          renderer.scene.instance.updateMatrixWorld(true);
          const shutterRoot = renderer.scene.findByProps({ name: "mounted-shutter" }).instance;
          const inverse = shutterRoot.matrixWorld.clone().invert();
          const windowRoot = renderer.scene.findByProps({
            name: `opening-model-${opening.variant}`,
          }).instance;
          const worldSill = opening.sillHeightMeters;
          windowRoot.traverse((object) => {
            if (!object.isMesh) return;
            const box = new Box3().setFromObject(object);
            if (box.max.y < worldSill + 0.01) return; // The fixed sill sits below the fitted shutter.
            for (const x of [box.min.x, box.max.x])
              for (const y of [box.min.y, box.max.y])
                for (const z of [box.min.z, box.max.z]) {
                  const local = new Vector3(x, y, z).applyMatrix4(inverse);
                  assert.ok(
                    local.z <= -0.003 + 1e-6,
                    `${kind}: closed geometry must clear shutter by 3 mm (${local.z})`,
                  );
                }
          });
          if (thickness === 0.4)
            assert.ok(candidate.placement.depthOffsetMeters < 0, "deep walls recess the assembly");
          await renderer.unmount();
        }
      }
    }
  });

  test("the app assigns fitted shutters to the indoor room without changing saved offsets", () => {
    for (const thickness of [0.2, 0.9]) {
      const { floor, item, project } = fixture();
      floor.walls.find((wall) => wall.id === item.placement.wallId).thicknessMeters = thickness;
      const placement = { ...item.placement, depthOffsetMeters: -0.043 };
      project.sceneItems = [{ ...item, placement }];
      const manifest = composeOwnerProjectManifest(project);
      assert.equal(outsideRoomDevices(manifest, floor.id), null);
      assert.deepEqual(
        e.collectBindingSlots(manifest).find((slot) => slot.slotId === item.entitySlots[0].id)
          .roomIds,
        ["fixture-studio"],
      );
      assert.deepEqual(manifest.sceneItems[0].placement, placement);
    }
  });

  test("exterior fitting retains world position through translated non-metre coordinates", () => {
    const { floor } = fixture();
    const before = windowPlacements(definition, floor, [2.7, 1])[0];
    const mapPoint = ([x, z]) => [10 + x * 2, 20 + z * 2];
    const scaled = {
      ...floor,
      coordinates: { ...floor.coordinates, origin: [10, 20], metersPerPlanUnit: 0.5 },
      walls: floor.walls.map((wall) => ({
        ...wall,
        from: mapPoint(wall.from),
        to: mapPoint(wall.to),
      })),
      rooms: floor.rooms.map((room) => ({ ...room, polygon: room.polygon.map(mapPoint) })),
      openings: floor.openings.map((opening) => ({
        ...opening,
        offsetFromWallStartPlanUnits: opening.offsetFromWallStartPlanUnits * 2,
        widthPlanUnits: opening.widthPlanUnits * 2,
      })),
    };
    const after = windowPlacements(definition, scaled, mapPoint([2.7, 1]))[0];
    assert.deepEqual(after.size, before.size);
    const first = e.resolveItemTransform(before.placement, floor);
    const second = e.resolveItemTransform(after.placement, scaled);
    second.position.forEach((value, axis) =>
      assert.ok(Math.abs(value - first.position[axis]) < 1e-10),
    );
    assert.equal(second.rotationYRadians, first.rotationYRadians);
    assert.equal(
      e.roomIdForItem({ ...fixture().item, placement: after.placement }, scaled, definition),
      "fixture-studio",
    );
  });

  test("fitting rejects internal, ambiguous, solid, virtual, and roomless supports", () => {
    const { floor } = fixture();
    const room = floor.rooms[0];
    const cases = [
      { ...floor, rooms: [] },
      { ...floor, rooms: [{ ...room, isSolid: true }] },
      { ...floor, rooms: [room, { ...room, id: "ambiguous" }] },
      {
        ...floor,
        rooms: [
          room,
          { ...room, id: "other-side", polygon: room.polygon.map(([x, z]) => [x, -z]) },
        ],
      },
      { ...floor, walls: floor.walls.map((wall) => ({ ...wall, virtual: true })) },
    ];
    for (const changed of cases)
      assert.deepEqual(windowPlacements(definition, changed, [2.7, 1]), []);
    const distant = {
      ...floor,
      rooms: [{ ...room, polygon: room.polygon.map(([x, z]) => [x, z + 1]) }],
    };
    assert.deepEqual(
      windowPlacements(definition, distant, [2.7, 1]),
      [],
      "never choose an arbitrary nearest room",
    );
  });

  test("the indoor room owns Connect, live state, placed-item groups and shortcuts beside an outdoor platform", () => {
    const { floor, item, project } = fixture();
    const polygon = [
      [0, -2],
      [8, -2],
      [8, 0],
      [0, 0],
    ];
    floor.outdoorPlatforms = [
      {
        id: "patio",
        polygon,
        useAsRoom: true,
        roomName: "Patio",
        finish: { kind: "solid", color: "#bbbbbb" },
        defaultEdge: { kind: "open" },
        edges: polygon.map((_, index) => ({ id: `patio-edge-${index}` })),
      },
    ];
    project.actionBar = {
      items: [{ id: "shutter-shortcut", target: { kind: "device", deviceId: item.id } }],
    };
    const valid = e.validateHomeProject(project, registries);
    assert.equal(valid.valid, true, JSON.stringify(valid.issues));
    const manifest = composeOwnerProjectManifest(project);
    assert.equal(e.roomIdForItem(item, floor, definition), "fixture-studio");
    assert.equal(e.resolvedRoomIdForItem(item, project, definition), "fixture-studio");
    assert.equal(e.isActionBarDeviceNavigable(project, item.id, registries.deviceModels), true);
    assert.equal(outsideRoomDevices(manifest, floor.id), null);
    const descriptor = e
      .collectBindingSlots(manifest)
      .find((slot) => slot.slotId === item.entitySlots[0].id);
    assert.deepEqual(descriptor.roomIds, ["fixture-studio"]);
    assert.deepEqual(descriptor.spec.compatibleDomains, ["cover"]);
    assert.equal(descriptor.spec.autoMap, "manual");
    assert.equal(
      e
        .deviceMappingRooms(manifest)
        .flatMap((room) => room.devices)
        .filter((device) => device.id === item.id).length,
      1,
    );
    const runtime = connectedRuntimeFixture();
    const profile = {
      ...e.createEmptyRuntimeBindingProfile(project.home.id),
      roomAreaIds: { "fixture-studio": "demo_room" },
      entityIdsBySlotId: { [item.entitySlots[0].id]: "cover.demo_shade" },
    };
    assert.equal(e.validateRuntimeBindingProfile(profile, manifest, runtime).valid, true);
    const resolved = e.resolveHomeAssistantBindings(
      manifest,
      profile,
      runtime,
      registries.deviceModels,
    );
    assert.equal(
      statesBySlotIdForRoom(e.roomIdForItem(item, manifest.floors[0], definition), resolved)[
        item.entitySlots[0].id
      ].entityId,
      "cover.demo_shade",
    );
    assert.deepEqual(resolveActionBarDestination(manifest, { kind: "device", deviceId: item.id }), {
      floorId: floor.id,
      roomId: "fixture-studio",
      deviceId: item.id,
    });
    const list = renderToStaticMarkup(
      createElement(ArrangePlacedItems, {
        floor,
        items: [item],
        ...registries,
        selectedIds: [],
        disabled: false,
        onSelect() {},
      }),
    );
    assert.match(list, /Fixture studio/);
    assert.doesNotMatch(list, /<h3>Patio|<h3>Outside rooms/);
    const choices = renderToStaticMarkup(
      createElement(ShortcutPicker, {
        picker: { kind: "device", replacingId: null },
        project,
        deviceModels: registries.deviceModels,
        devices: [item],
        rooms: manifest.floors[0].rooms,
        roomPictures: {},
        roomNames: {},
        deviceNames: {},
        walkTools: [],
        query: "",
        matching: () => true,
        duplicate: () => false,
        choose() {},
        setQuery() {},
        onClose() {},
      }),
    );
    assert.match(choices, /Integrated roller shutter/);
    assert.match(choices, /Fixture studio/);
    assert.doesNotMatch(choices, /aria-label="Patio"/);
  });

  test("upper-floor fitting, snapping, free movement, duplication and history preserve ordinary project data", () => {
    const { floor, item, project } = fixture();
    const upper = { ...floor, elevationMeters: 3, id: "upper-floor" };
    const candidate = catalogStartPlacement(entry, upper, [2.7, 1]);
    assert.ok(candidate.placement, candidate.error);
    const resized = { ...item, size: [item.size[0] * 0.8, item.size[1] * 0.7, item.size[2]] };
    const transform = e.resolveItemTransform(item.placement, floor);
    const moved = placementForWorldDrag({
      world: { x: transform.position[0], z: transform.position[2] },
      item: resized,
      definition,
      floor,
      raw: false,
    });
    assert.equal(moved.kind, "wall");
    assert.equal(moved.face, item.placement.face);
    assert.equal(
      e.roomIdForItem({ ...resized, placement: moved }, floor, definition),
      "fixture-studio",
    );
    const free = placementForWorldDrag({
      world: { x: -3, z: -3 },
      item,
      definition,
      floor,
      raw: true,
    });
    assert.equal(free.kind, "absolute");
    assert.equal(e.roomIdForItem({ ...item, placement: free }, floor, definition), null);
    const indoor = { ...free, at: [2, 2] };
    assert.equal(
      e.roomIdForItem({ ...item, placement: indoor }, floor, definition),
      "fixture-studio",
    );
    let state = createFurnishingEditorState([item]);
    state = furnishingEditorReducer(state, {
      type: "update-placement-and-size",
      id: item.id,
      placement: moved,
      size: resized.size,
      definition,
    });
    assert.deepEqual(state.items[0].size, resized.size);
    state = furnishingEditorReducer(state, { type: "undo" });
    assert.deepEqual(state.items[0], item);
    state = furnishingEditorReducer(state, { type: "redo" });
    state = furnishingEditorReducer(state, { type: "duplicate", id: item.id, floor });
    const copy = state.items[1];
    assert.notEqual(copy.id, item.id);
    assert.notEqual(copy.entitySlots[0].id, item.entitySlots[0].id);
    assert.equal(e.roomIdForItem(copy, floor, definition), "fixture-studio");
    project.sceneItems = state.items;
    const parsed = e.parseHomeProject(e.serializeHomeProject(project));
    assert.equal(parsed.valid, true, JSON.stringify(parsed.issues));
    assert.deepEqual(parsed.project.sceneItems, state.items);
    assert.equal(e.validateHomeProject(parsed.project, registries).valid, true);
  });
});
