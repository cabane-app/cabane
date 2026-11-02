import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { useConstructEditor } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );
  const { executeConstructAction } = await load(
    "/apps/web/src/agent-pilot/agent-construct-actions.ts",
  );
  const floor = engine.deriveFloorTopology({
    floorId: "ground",
    floorName: "Ground",
    walls: [
      { id: "north", from: [0, 0], to: [8, 0] },
      { id: "east", from: [8, 0], to: [8, 4] },
      { id: "south", from: [8, 4], to: [0, 4] },
      { id: "west", from: [0, 4], to: [0, 0] },
      { id: "divider", from: [4, 0], to: [4, 4] },
    ],
    rooms: [
      { id: "living", name: "Living", accent: "#aabbcc", anchor: [2, 2] },
      { id: "kitchen", name: "Kitchen", accent: "#aabbcc", anchor: [6, 2] },
    ],
    openings: [],
  }).floor;

  async function withEditors(run) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    const names = ["window", "document", "navigator", "HTMLElement"];
    const previous = Object.fromEntries(
      names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    );
    for (const name of names)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value: dom.window[name],
      });
    const root = createRoot(dom.window.document.getElementById("root"));
    let ui;
    let agent;
    function Harness() {
      ui = useConstructEditor(floor);
      agent = useConstructEditor(floor);
      return null;
    }
    try {
      await act(async () => root.render(createElement(Harness)));
      await run(() => ({ ui, agent }));
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      for (const name of names) {
        if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
        else delete globalThis[name];
      }
    }
  }

  test("agent opening placement uses the UI's configuration, fit checks and history", async () => {
    await withEditors(async (current) => {
      const wallId = current().agent.draft.walls.find(
        (wall) => wall.from[1] === 0 && wall.to[1] === 0,
      ).id;
      const configuration = {
        kind: "door",
        operation: "sliding",
        variant: "full-glass",
        finish: "white",
        leafCount: 2,
        widthMeters: 2.4,
        heightMeters: 2.1,
      };
      await act(async () => {
        current().ui.placeOpening("door", wallId, 0.5, "left", configuration);
        executeConstructAction(current().agent, {
          type: "add-opening",
          kind: "door",
          wallId,
          offsetPlanUnits: 0.5,
          side: "left",
          doorConfiguration: configuration,
        });
      });
      const { id: _uiId, ...uiOpening } = current().ui.draft.openings[0];
      const { id: _agentId, ...agentOpening } = current().agent.draft.openings[0];
      assert.deepEqual(agentOpening, uiOpening);
      assert.equal(agentOpening.widthPlanUnits, 2.4);
      assert.equal(current().agent.history.past.length, 1);

      const before = current().agent.draft;
      await act(async () => {
        assert.equal(current().ui.placeOpening("door", wallId, 0.5, "left", configuration), false);
        assert.throws(
          () =>
            executeConstructAction(current().agent, {
              type: "add-opening",
              kind: "door",
              wallId,
              offsetPlanUnits: 0.5,
              doorConfiguration: configuration,
            }),
          /does not fit/,
        );
      });
      assert.equal(current().agent.draft, before);
      assert.equal(current().agent.history.past.length, 1);

      await act(async () =>
        executeConstructAction(current().agent, {
          type: "duplicate-opening",
          openingId: current().agent.draft.openings[0].id,
        }),
      );
      assert.equal(current().agent.draft.openings.length, 2);
      assert.equal(current().agent.history.past.length, 2);
      await act(async () => current().agent.undo());
      assert.equal(current().agent.draft.openings.length, 1);
    });
  });

  test("agent room deletion preserves shared walls exactly as selected-room deletion", async () => {
    await withEditors(async (current) => {
      await act(async () => current().ui.selectRoom("living"));
      await act(async () => {
        current().ui.deleteSelected();
        executeConstructAction(current().agent, {
          type: "delete-elements",
          targets: [{ kind: "room", id: "living" }],
        });
      });
      assert.deepEqual(current().agent.draft.walls, current().ui.draft.walls);
      assert.deepEqual(current().agent.draft.rooms, current().ui.draft.rooms);
      assert.ok(current().agent.draft.walls.some((wall) => wall.from[0] === 4 && wall.to[0] === 4));
      assert.equal(current().agent.history.past.length, 1);
    });
  });

  test("agent invisible walls share the drawing tool's durable edit and undo", async () => {
    await withEditors(async (current) => {
      await act(async () => current().ui.setTool("virtual-wall"));
      await act(async () => current().ui.beginWall([2, 0]));
      await act(async () => {
        current().ui.addWall([2, 4]);
        executeConstructAction(current().agent, {
          type: "add-wall",
          from: [2, 0],
          to: [2, 4],
          virtual: true,
        });
      });
      const added = (editor) => editor.draft.walls.find((wall) => wall.virtual);
      assert.deepEqual(added(current().agent)?.from, added(current().ui)?.from);
      assert.deepEqual(added(current().agent)?.to, added(current().ui)?.to);
      assert.equal(added(current().agent)?.virtual, true);
      assert.equal(current().agent.history.past.length, 1);
      await act(async () => current().agent.undo());
      assert.equal(added(current().agent), undefined);
    });
  });

  test("agent rejects malformed nested patches before calling the controller", async () => {
    const calls = [];
    const editor = new Proxy(
      {},
      {
        get:
          (_target, key) =>
          (...args) =>
            calls.push([key, args]),
      },
    );
    for (const action of [
      { type: "add-wall", from: [0, 0], to: [Infinity, 1] },
      {
        type: "update-room-metadata",
        roomId: "living",
        changes: { floorFinish: { kind: "solid", color: 7 } },
      },
      { type: "update-wall-metadata", wallId: "north", changes: { niches: [{ id: "bad" }] } },
      {
        type: "update-outdoor-platform",
        id: "platform",
        changes: {
          edges: [{ id: "edge", configuration: { kind: "railing", heightMeters: "high" } }],
        },
      },
      { type: "update-hedge", id: "hedge", changes: { id: "replacement" } },
      { type: "delete-elements", targets: [{ kind: "room", id: "living", span: [0, 1] }] },
      {
        type: "paint-room-floor",
        roomId: "living",
        finish: { kind: "solid", color: "#aabbcc" },
        clearZones: "yes",
      },
    ])
      assert.throws(() => executeConstructAction(editor, action));
    assert.deepEqual(calls, []);
  });
});
