import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { withStorageDom } from "./dom-test-environment.mjs";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { HomeAssistantActivityTracker } = await load(
    "/packages/engine/src/home-assistant-activity.ts",
  );
  const { useEntityActivityFeedback } = await load(
    "/packages/engine/src/useEntityActivityFeedback.ts",
  );
  const { ComicPew } = await load("/packages/engine/src/comic-pew/ComicPew.tsx");
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
    assert.ok(
      Object.values(tracker.update(initial, start)).every((state) => !state.activitySequence),
    );
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
    assert.equal(
      current["event.remote"].activitySequence,
      first,
      "duplicate snapshots do not pulse",
    );
    current = tracker.update(
      { ...current, "event.remote": { ...current["event.remote"], state: timestamp(300) } },
      start + 300,
    );
    assert.ok(
      current["event.remote"].activitySequence > first,
      "same type, newer timestamp pulses",
    );
    const repeated = current["event.remote"].activitySequence;
    current = tracker.update(
      { ...current, "event.remote": { ...current["event.remote"], state: timestamp(100) } },
      start + 400,
    );
    current = tracker.update(
      { ...current, "event.remote": { ...current["event.remote"], state: timestamp(300) } },
      start + 500,
    );
    assert.equal(
      current["event.remote"].activitySequence,
      repeated,
      "out-of-order replay is deduplicated",
    );
    const power = current["switch.power"].activitySequence;
    current = tracker.update(
      {
        ...current,
        "switch.power": { ...current["switch.power"], attributes: { friendly_name: "Power" } },
      },
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
    assert.equal(
      current["event.remote"].activitySequence,
      undefined,
      "reconnect replay stays quiet",
    );
    current = tracker.update(snapshots(raw("event.remote", timestamp(1200), 1200)), start + 1200);
    assert.ok(current["event.remote"].activitySequence);
    const restored = new HomeAssistantActivityTracker();
    restored.update(snapshots(raw("event.remote", "unknown", 0)), start);
    assert.equal(
      restored.update(
        snapshots(raw("event.remote", timestamp(100), 100, { restored: true })),
        start + 100,
      )["event.remote"].activitySequence,
      undefined,
    );
  });

  const { pewArt } = await load("/packages/engine/src/comic-pew/pew-art.ts");
  test("the gun keeps its alternating words while devices request ZAP", () => {
    assert.deepEqual(
      [1, 2, 3].map((id) => pewArt(id).label),
      ["PEW!", "ZAP!", "POW!"],
    );
    assert.deepEqual(
      [1, 2, 3].map((id) => pewArt(id, undefined, "ZAP!").label),
      ["ZAP!", "ZAP!", "ZAP!"],
    );
  });

  test("device comic feedback baselines mappings/remounts and clears only after its own animation", async () => {
    await withStorageDom(async ({ document, window }) => {
      function Feedback({ sequence, entityId = "event.remote", reducedMotion = false }) {
        const { pulse, clear } = useEntityActivityFeedback([
          {
            slotId: "remote",
            entityId,
            issues: [],
            state: {
              entityId,
              state: timestamp(100),
              available: true,
              stale: false,
              activitySequence: sequence,
            },
          },
        ]);
        return pulse
          ? React.createElement(ComicPew, {
              shotId: pulse,
              word: "ZAP!",
              reducedMotion,
              onComplete: clear,
            })
          : null;
      }
      const container = document.createElement("div");
      document.body.append(container);
      let root = createRoot(container);
      const render = async (sequence, entityId = "event.remote", reducedMotion = false) =>
        act(async () =>
          root.render(React.createElement(Feedback, { sequence, entityId, reducedMotion })),
        );
      const bubble = () => container.querySelector(".comic-pew");
      const finish = async (element = bubble()) =>
        act(async () => element.dispatchEvent(new window.Event("animationend", { bubbles: true })));
      try {
        await render(10);
        assert.equal(bubble(), null, "initial history is silent");
        await render(11);
        assert.ok(bubble().querySelector("svg"), "uses the shared comic artwork");
        await finish(bubble().querySelector(".comic-pew__rays"));
        assert.ok(bubble(), "child ray animation cannot dismiss the bubble early");
        await render(12);
        assert.equal(bubble().querySelector("title").textContent, "ZAP!");
        assert.equal(bubble().dataset.shot, "12", "a new press restarts the comic animation");
        await finish();
        assert.equal(bubble(), null, "completion removes the overlay");
        await render(12);
        assert.equal(bubble(), null, "duplicate snapshot stays quiet");
        await render(20, "event.replacement");
        assert.equal(bubble(), null, "remapping establishes its baseline");
        await render(21, "event.replacement", true);
        assert.equal(bubble().dataset.reducedMotion, "true");
        await finish();
        assert.equal(bubble(), null);
        await act(async () => root.unmount());
        root = createRoot(container);
        await render(21, "event.replacement");
        assert.equal(bubble(), null, "remounting does not replay history");
      } finally {
        await act(async () => root.unmount());
      }
    });
  });
});
