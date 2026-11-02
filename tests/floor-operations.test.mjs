import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";
await withModules(async (load) => {
  const api = await load("/packages/engine/src/index.ts");
  const { makeThreeFloorProject } = await load("/tests/fixtures/multiple-floors.ts");
  test("adding creates an empty top level, renaming does not change identity", () => {
    const initial = { project: makeThreeFloorProject(), bindings: {} };
    const added = api.addTopFloor(initial, "third");
    assert.equal(added.project.floors.length, 4);
    assert.deepEqual(added.project.floors[3].footprint, []);
    assert.deepEqual(added.project.floors[3].walls, []);
    assert.equal(added.project.floors[3].floorToFloorHeightMeters, 2.6);
    assert.equal(api.renameFloor(added, "first", " Bedrooms ").project.floors[1].name, "Bedrooms");
    assert.throws(() => api.renameFloor(added, "first", " "), /name/);
  });
  test("top removal and private draft changes undo together; ground cannot be removed", () => {
    const initial = { project: makeThreeFloorProject(), bindings: {} };
    const profile = {
      schemaVersion: 1,
      homeId: initial.project.home.id,
      roomAreaIds: { "second-demo-room": "synthetic-area" },
      entityIdsBySlotId: {},
    };
    initial.bindings["https://synthetic.invalid"] = {
      draft: profile,
      published: profile,
      manualRoomIds: ["second-demo-room"],
      manualSlotIds: [],
    };
    const removed = api.removeTopFloor(initial);
    assert.deepEqual(removed.bindings["https://synthetic.invalid"].draft.roomAreaIds, {});
    assert.deepEqual(removed.bindings["https://synthetic.invalid"].published, profile);
    const history = api.commitWorkspaceSnapshot(api.createWorkspaceHistory(initial), removed);
    assert.deepEqual(api.undoWorkspaceHistory(history).present, initial);
    assert.throws(() => api.removeTopFloor(api.removeTopFloor(removed)), /ground floor/);
  });
  for (const add of ["addTopFloor", "addBottomFloor"]) {
    test(`${add} duplicates Construct elements without furniture, devices or mappings`, () => {
      const project = makeThreeFloorProject();
      const source = project.floors[0];
      source.floorToFloorHeightMeters = 3.1;
      source.rooms[0].floorFinish = { kind: "preset", preset: "travertine" };
      source.rooms[0].floorZones = [
        {
          id: "zone",
          polygon: source.rooms[0].polygon,
          finish: { kind: "solid", color: "#123456" },
        },
      ];
      source.walls[0].niches = [
        {
          id: "niche",
          side: "left",
          offsetFromWallStartPlanUnits: 1,
          widthPlanUnits: 0.4,
          bottomMeters: 1,
          heightMeters: 0.3,
          depthMeters: 0.05,
        },
      ];
      source.ceilings = [
        { id: "ceiling", kind: "flat", roomIds: [source.rooms[0].id], heightMeters: 2.4 },
      ];
      source.outdoorPlatforms = [
        {
          id: "platform",
          polygon: source.rooms[0].polygon,
          finish: { kind: "preset", preset: "travertine" },
          defaultEdge: { kind: "open" },
          edges: source.rooms[0].polygon.map((_, i) => ({ id: `edge-${i}` })),
        },
      ];
      const slot = {
        id: "slot",
        compatibleDomains: ["light"],
        required: true,
        autoMap: "unique-compatible",
        deviceRole: "primary",
        presentation: { label: "Light", dashboardRole: "primary" },
      };
      project.roomProfiles[source.rooms[0].id] = { dashboardSlots: [{ ...slot, id: "room-slot" }] };
      const opening = source.openings.find((value) => value.kind !== "passage");
      assert.ok(opening);
      project.openingProfiles[opening.id] = {
        contactSlot: {
          id: "contact",
          compatibleDeviceClasses: ["door"],
          openState: "on",
          autoMap: "unique-compatible",
        },
      };
      project.sceneItems = [
        {
          id: "lamp",
          kind: "device",
          floorId: source.id,
          modelId: "synthetic-light",
          size: [0.1, 0.1, 0.1],
          entitySlots: [slot],
          placement: {
            kind: "ceiling",
            roomId: source.rooms[0].id,
            at: [1, 1],
            dropMeters: 0,
            rotationYRadians: 0,
          },
        },
        {
          id: "picture",
          kind: "furnishing",
          floorId: source.id,
          modelId: "synthetic-picture",
          size: [0.1, 0.1, 0.1],
          placement: {
            kind: "wall",
            wallId: source.walls[0].id,
            face: "left",
            offsetFromWallStartPlanUnits: 1,
            elevationMeters: 1,
            depthOffsetMeters: 0,
            rotationOffsetRadians: 0,
          },
        },
      ];
      project.stairs = [
        {
          id: "stairs",
          lowerFloorId: "ground",
          upperFloorId: "first",
          at: [1, 1],
          rotationYRadians: 0,
          widthMeters: 1,
          runMeters: 3,
        },
      ];
      const profile = {
        schemaVersion: 1,
        homeId: project.home.id,
        roomAreaIds: { [source.rooms[0].id]: "synthetic-area" },
        entityIdsBySlotId: { slot: "light.synthetic" },
      };
      const initial = {
        project,
        bindings: {
          "https://synthetic.invalid": {
            draft: profile,
            published: profile,
            manualRoomIds: [],
            manualSlotIds: [],
          },
        },
      };
      const before = structuredClone(initial);
      const next = api[add](initial, "copy", { sourceFloorId: source.id });
      assert.deepEqual(next.project.sceneItems, project.sceneItems);
      assert.deepEqual(next.project.roomProfiles, project.roomProfiles);
      assert.deepEqual(next.project.openingProfiles, project.openingProfiles);
      assert.deepEqual(initial, before);
      assert.deepEqual(next.bindings, initial.bindings);
      assert.deepEqual(next.project.stairs, project.stairs);
      const floor = next.project.floors.find((value) => value.id === "copy");
      assert.equal(floor.belowGround, add === "addBottomFloor" ? true : undefined);
      assert.equal(floor.floorToFloorHeightMeters, 3.1);
      assert.deepEqual(floor.footprint, source.footprint);
      assert.deepEqual(floor.rooms[0].floorFinish, source.rooms[0].floorFinish);
      assert.notEqual(floor.rooms[0].floorZones[0].id, "zone");
      assert.notEqual(floor.walls[0].niches[0].id, "niche");
      assert.deepEqual(floor.ceilings[0].roomIds, [floor.rooms[0].id]);
      floor.openings.forEach((value) =>
        assert.ok(floor.walls.some((wall) => wall.id === value.wallId)),
      );
      floor.wallJunctions.forEach((value) =>
        value.wallIds.forEach((id) => assert.ok(floor.walls.some((wall) => wall.id === id))),
      );
      assert.notEqual(floor.outdoorPlatforms[0].edges[0].id, "edge-0");
      assert.equal(next.project.sceneItems.filter((item) => item.floorId === "copy").length, 0);
      assert.equal(next.project.roomProfiles[floor.rooms[0].id], undefined);
      assert.equal(next.project.openingProfiles[floor.openings[0].id], undefined);
      const ids = api.collectProjectIds(next.project);
      assert.equal(ids.length, new Set(ids).size);
      assert.equal(api.parseHomeProjectSchema(next.project).valid, true);
      const history = api.commitWorkspaceSnapshot(api.createWorkspaceHistory(initial), next);
      assert.deepEqual(api.undoWorkspaceHistory(history).present, initial);
      assert.deepEqual(api.redoWorkspaceHistory(api.undoWorkspaceHistory(history)).present, next);
      assert.throws(
        () => api[add](initial, "bad-copy", { sourceFloorId: "missing" }),
        /source floor/,
      );
    });
  }
});
