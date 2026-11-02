import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { lightDimmerPercent } = await load(
    "/packages/engine/src/home-assistant-dashboard/light-fields.tsx",
  );
  const light = (overrides = {}) => ({
    entityId: "light.test",
    state: "on",
    attributes: { brightness: 128 },
    available: true,
    stale: false,
    ...overrides,
  });

  test("a light that is off reads 0%, though Home Assistant reports its brightness as null", () => {
    assert.equal(lightDimmerPercent(light({ state: "off", attributes: { brightness: null } })), 0);
    assert.equal(lightDimmerPercent(light({ state: "off", attributes: {} })), 0);
    assert.equal(lightDimmerPercent(light({ state: "off", attributes: { brightness: 128 } })), 0);
  });

  test("a light that is unavailable or stale reads 0%", () => {
    assert.equal(lightDimmerPercent(light({ available: false })), 0);
    assert.equal(lightDimmerPercent(light({ stale: true })), 0);
    assert.equal(lightDimmerPercent(undefined), 0);
  });

  test("a lit light reads its brightness, from 1% to 100%, and never 0%", () => {
    assert.equal(lightDimmerPercent(light({ attributes: { brightness: 128 } })), 50);
    assert.equal(lightDimmerPercent(light({ attributes: { brightness: 255 } })), 100);
    assert.equal(lightDimmerPercent(light({ attributes: { brightness: 1 } })), 1);
  });

  test("a lit light that reports no brightness reads full", () => {
    assert.equal(lightDimmerPercent(light({ attributes: {} })), 100);
    assert.equal(lightDimmerPercent(light({ attributes: { brightness: null } })), 100);
  });
});
