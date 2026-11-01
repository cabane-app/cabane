import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { create, act } from "@react-three/test-renderer";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { HomeAssistantActivityTracker } = await load(
    "/packages/engine/src/home-assistant-activity.ts",
  );
  const { SceneItemActivityFeedback } = await load("/packages/engine/src/SceneItemActivityFeedback.tsx");
  const { normalizeEntityStates } = await load(
    "/packages/engine/src/home-assistant-entity-snapshots.ts",
  );
  const start = Date.parse("2026-11-01T12:00:00Z");
  const timestamp = (offset) => new Date(start + offset).toISOString();
  const raw = (id, state, at, attributes = {}) => ({
    entity_id: id,
    state,
    attributes,
    last_changed: timestamp(at),
    last_updated: timestamp(at),
  });
  const snapshots = (...states) =>
    normalizeEntityStates(Object.fromEntries(states.map((state) => [state.entity_id, state])));

  test("live HA activity ignores initial/restored history, duplicates, attributes and unavailable transitions", () => {
    const tracker = new HomeAssistantActivityTracker();
    const initial = snapshots(
      raw("event.remote", timestamp(-10000), 0, { event_type: "press" }),
      raw("button.press", "unknown", 0),
      raw("switch.power", "off", 0),
      raw("sensor.power", "0", 0),
    );
    assert.ok(Object.values(tracker.update(initial, start)).every((state) => !state.activitySequence));
    let current = tracker.update(
      snapshots(
        raw("event.remote", timestamp(100), 100, { event_type: "press" }),
        raw("button.press", timestamp(100), 100),
        raw("switch.power", "on", 100),
        raw("sensor.power", "30", 100),
      ),
      start + 100,
    );
    for (const id of ["event.remote", "button.press", "switch.power"])
      assert.ok(current[id].activitySequence, id);
    assert.equal(current["sensor.power"].activitySequence, undefined);
    const first = current["event.remote"].activitySequence;
    current = tracker.update(structuredClone(current), start + 200);
    assert.equal(current["event.remote"].activitySequence, first, "duplicate snapshots do not pulse");
    current = tracker.update(
      { ...current, "event.remote": { ...current["event.remote"], state: timestamp(300) } },
      start + 300,
    );
    assert.ok(current["event.remote"].activitySequence > first, "same type, newer timestamp pulses");
    const repeated = current["event.remote"].activitySequence;
    current = tracker.update(
      { ...current, "event.remote": { ...current["event.remote"], state: timestamp(100) } },
      start + 400,
    );
    current = tracker.update(
      { ...current, "event.remote": { ...current["event.remote"], state: timestamp(300) } },
      start + 500,
    );
    assert.equal(current["event.remote"].activitySequence, repeated, "out-of-order replay is deduplicated");
    const power = current["switch.power"].activitySequence;
    current = tracker.update(
      { ...current, "switch.power": { ...current["switch.power"], attributes: { friendly_name: "Power" } } },
      start + 600,
    );
    assert.equal(current["switch.power"].activitySequence, power);
    for (const state of [
      { ...current["switch.power"], available: false, state: "unavailable" },
      { ...current["switch.power"], state: "off", lastChanged: timestamp(700) },
      { ...current["switch.power"], state: "on", stale: true, lastChanged: timestamp(800) },
      { ...current["switch.power"], state: "off", lastChanged: timestamp(900) },
    ]) {
      current = tracker.update({ ...current, "switch.power": state }, start + 900);
      assert.equal(current["switch.power"].activitySequence, power);
    }
    tracker.reset();
    assert.equal(tracker.update(current, start + 1000)["event.remote"].activitySequence, undefined);
    current = tracker.update(snapshots(raw("event.remote", timestamp(800), 1100)), start + 1100);
    assert.equal(current["event.remote"].activitySequence, undefined, "reconnect replay stays quiet");
    current = tracker.update(snapshots(raw("event.remote", timestamp(1200), 1200)), start + 1200);
    assert.ok(current["event.remote"].activitySequence);
    const restored = new HomeAssistantActivityTracker();
    restored.update(snapshots(raw("event.remote", "unknown", 0)), start);
    assert.equal(
      restored.update(snapshots(raw("event.remote", timestamp(100), 100, { restored: true })), start + 100)["event.remote"].activitySequence,
      undefined,
    );
  });

  test("device feedback baselines mappings/remounts and cleans up its shared zap effect without timers", async () => {
    const bounds = { min: [-0.04, 0, 0], max: [0.04, 0.08, 0.015] };
    const render = (sequence, entityId = "event.remote", reducedMotion = false) =>
      React.createElement(SceneItemActivityFeedback, {
        bounds,
        reducedMotion,
        entities: [{ slotId: "remote", entityId, issues: [], state: { entityId, state: timestamp(100), available: true, stale: false, activitySequence: sequence } }],
      });
    const renderer = await create(render(10));
    const count = () => renderer.scene.findAllByProps({ name: "scene-item-activity-feedback" }).length;
    try {
      assert.equal(count(), 0, "mounting history is silent");
      await renderer.update(render(11));
      assert.equal(count(), 1);
      await renderer.advanceFrames(1, 0.1);
      assert.equal(renderer.scene.findByProps({ name: "laser-impact" }).instance.visible, true);
      await act(async () => renderer.advanceFrames(1, 0.6));
      assert.equal(count(), 0);
      await renderer.update(render(11));
      assert.equal(count(), 0, "rerender does not replay the latest activity");
      await renderer.update(render(20, "event.replacement"));
      assert.equal(count(), 0, "remapping establishes its own baseline");
      await renderer.update(render(21, "event.replacement", true));
      await renderer.advanceFrames(1, 0.1);
      const pulse = renderer.scene.findByProps({ name: "laser-impact" }).instance;
      assert.deepEqual(pulse.scale.toArray(), [1, 1, 1], "reduced motion keeps feedback stationary");
      assert.equal(pulse.children.length, 3, "reduced motion omits the expanding rays");
      await act(async () => renderer.advanceFrames(1, 0.6));
      assert.equal(count(), 0);
    } finally {
      await renderer.unmount();
    }
    const remounted = await create(render(21, "event.replacement"));
    assert.equal(remounted.scene.findAllByProps({ name: "scene-item-activity-feedback" }).length, 0);
    await remounted.unmount();
  });
});
