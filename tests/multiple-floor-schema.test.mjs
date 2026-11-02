import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { parseHomeProjectSchema } = await load("/packages/engine/src/home-project/validation.ts");
  const { makeLegacyProject } = await load("/tests/fixtures/multiple-floors.ts");

  test("apartment floor survives serialization and rejects invalid storey counts", () => {
    const project = parseHomeProjectSchema(makeLegacyProject()).project;
    for (const count of [0, 3, 100]) {
      project.home.apartmentFloor = count;
      const result = parseHomeProjectSchema(JSON.parse(JSON.stringify(project)));
      assert.equal(result.valid, true);
      assert.equal(result.project.home.apartmentFloor, count);
      assert.deepEqual(result.project.floors, project.floors);
    }
    for (const count of [-1, 1.5, 101, "3", null, Infinity]) {
      project.home.apartmentFloor = count;
      assert.equal(parseHomeProjectSchema(project).valid, false);
    }
  });

  test("normalizes V1 without changing geometry, IDs, or the source", () => {
    const legacy = makeLegacyProject();
    const before = structuredClone(legacy);
    const result = parseHomeProjectSchema(legacy);
    assert.equal(result.valid, true);
    assert.equal(result.project.schemaVersion, 2);
    assert.deepEqual(result.project.floors[0].rooms, legacy.floor.rooms);
    assert.deepEqual(result.project.coordinates, legacy.floor.coordinates);
    assert.equal(result.project.floors[0].id, legacy.floor.id);
    assert.equal(result.project.floors[0].floorToFloorHeightMeters, 2.55);
    assert.deepEqual(result.project.stairs, []);
    assert.equal("floor" in result.project, false);
    assert.deepEqual(legacy, before);
  });

  test("rejects unknown versions and accessors without reading them", () => {
    assert.equal(
      parseHomeProjectSchema({ ...makeLegacyProject(), schemaVersion: 99 }).valid,
      false,
    );
    let reads = 0;
    const candidate = makeLegacyProject();
    Object.defineProperty(candidate, "floor", {
      get() {
        reads++;
        throw new Error("must not execute");
      },
    });
    assert.equal(parseHomeProjectSchema(candidate).valid, false);
    assert.equal(reads, 0);
  });

  test("accepts an empty additional draft floor but rejects conflicting transforms", () => {
    const result = parseHomeProjectSchema(makeLegacyProject());
    assert.equal(result.valid, true);
    const project = result.project;
    const ground = project.floors[0];
    project.floors.push({
      ...ground,
      id: "first",
      name: "Floor 1",
      footprint: [],
      rooms: [],
      walls: [],
      wallJunctions: [],
      openings: [],
      ceilings: [],
    });
    assert.equal(parseHomeProjectSchema(project).valid, true);
    project.floors[1].coordinates = { ...ground.coordinates, origin: [1, 0] };
    const invalid = parseHomeProjectSchema(project);
    assert.equal(invalid.valid, false);
    assert.ok(invalid.issues.some((x) => x.path === "floors[1].coordinates"));
  });
});
