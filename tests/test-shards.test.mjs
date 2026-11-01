import assert from "node:assert/strict";
import test from "node:test";
import { assignTestShards } from "./test-shards.mjs";

const files = [
  { name: "scene.test.mjs", browser: true, cost: 100 },
  { name: "picker.test.mjs", browser: true, cost: 50 },
  { name: "repository.test.mjs", browser: false, cost: 80 },
  { name: "editor.test.mjs", browser: false, cost: 40 },
  { name: "new.test.mjs", browser: false, cost: 40 },
  { name: "schema.test.mjs", browser: false, cost: 20 },
];

test("shards serialize every browser file and retain every Node file exactly once", () => {
  const shards = assignTestShards(files, 4, { serialBrowser: true });
  assert.deepEqual(shards[0], ["picker.test.mjs", "scene.test.mjs"]);
  assert.deepEqual(shards.flat().sort(), files.map((file) => file.name).sort());
  assert.ok(shards.slice(1).every((shard) => shard.length > 0));
  assert.deepEqual(assignTestShards([...files].reverse(), 4, { serialBrowser: true }), shards);
  assert.deepEqual(assignTestShards(files, 1), [files.map((file) => file.name).sort()]);
  const local = assignTestShards(files, 4);
  assert.deepEqual(local.flat().sort(), shards.flat().sort());
  assert.equal(
    local.filter((shard) =>
      shard.some((name) => name === "scene.test.mjs" || name === "picker.test.mjs"),
    ).length,
    2,
  );
});

test("unit-only shards use all four workers and balance measured costs", () => {
  const units = Array.from({ length: 8 }, (_, index) => ({
    name: `${index}.test.mjs`,
    browser: false,
    cost: index + 1,
  }));
  const shards = assignTestShards(units, 4);
  assert.deepEqual(
    shards.map((shard) =>
      shard.reduce((sum, name) => sum + units.find((file) => file.name === name).cost, 0),
    ),
    [9, 9, 9, 9],
  );
  assert.deepEqual(shards.flat().sort(), units.map((file) => file.name).sort());
});

test("browser-only and empty selections never duplicate or lose files", () => {
  assert.deepEqual(
    assignTestShards(
      files.filter((file) => file.browser),
      4,
      { serialBrowser: true },
    ),
    [["picker.test.mjs", "scene.test.mjs"], [], [], []],
  );
  assert.deepEqual(assignTestShards([], 4), [[], [], [], []]);
});
