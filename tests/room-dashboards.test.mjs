import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";
import { waitForAsyncCondition } from "./async-condition.mjs";

await withModules(async (load) => {
  const { normalizeDashboardViewPath, roomDashboardPath, DEFAULT_ROOM_DASHBOARD } = await load(
    "/packages/engine/src/room-dashboards/room-dashboard.ts",
  );
  const { discoverDashboardViews } = await load(
    "/packages/engine/src/room-dashboards/dashboard-views.ts",
  );
  const { attachDashboardAppearance } = await load(
    "/packages/engine/src/room-dashboards/embedded-dashboard.ts",
  );
  const engine = await load("/packages/engine/src/index.ts");
  const { neutralDemoManifest: manifest } = await load("/packages/engine/src/demo.ts");

  test("room dashboard targets use exact area IDs and store only same-origin, non-recursive paths", () => {
    const origin = "https://ha.fixture.test";
    assert.equal(
      roomDashboardPath({ ...DEFAULT_ROOM_DASHBOARD, view: "automatic" }, "kitchen"),
      "/home/areas-kitchen",
    );
    assert.equal(roomDashboardPath(DEFAULT_ROOM_DASHBOARD), null);
    assert.equal(
      normalizeDashboardViewPath(`${origin}/dashboard-tablet/kitchen`, origin),
      "/dashboard-tablet/kitchen",
    );
    for (const input of [
      "https://other.fixture.test/kitchen",
      "//other.fixture.test/kitchen",
      "/cabane",
      "/%63abane/home",
      "/home/../cabane",
      "/auth/authorize",
      "/local/page.html",
      "/home/overview?token=secret",
      "/home/overview#secret",
      "javascript:alert(1)",
      "https://user:secret@ha.fixture.test/home/overview",
    ]) {
      assert.equal(normalizeDashboardViewPath(input, origin), null, input);
    }
  });

  test("private room dashboard preferences round-trip and disappear only from deleted draft rooms", () => {
    const roomId = manifest.floors[0].rooms[0].id;
    const settings = {
      controls: "home-assistant",
      view: "/dashboard-tablet/kitchen",
      appearance: "cabane",
    };
    const profile = {
      ...engine.createEmptyRuntimeBindingProfile(manifest.home.id),
      roomDashboards: { [roomId]: settings },
    };
    const validated = engine.validateRuntimeBindingProfile(profile, manifest);
    assert.equal(validated.valid, true);
    assert.deepEqual(validated.profile, profile);
    assert.notEqual(validated.profile.roomDashboards[roomId], settings);
    assert.deepEqual(
      engine.validateRuntimeBindingProfile(
        JSON.parse(engine.exportRuntimeBindingProfile(profile)),
        manifest,
      ).profile,
      profile,
    );
    const bindings = {
      "https://ha.fixture.test": {
        draft: profile,
        published: structuredClone(profile),
        manualRoomIds: [],
        manualSlotIds: [],
      },
    };
    assert.deepEqual(engine.validateWorkspaceBindings(bindings, manifest, manifest), []);
    const removed = {
      ...manifest,
      floors: manifest.floors.map((floor) => ({
        ...floor,
        rooms: floor.rooms.filter((room) => room.id !== roomId),
      })),
    };
    const reconciled = engine.reconcileWorkspaceBindings(bindings, removed);
    assert.deepEqual(reconciled["https://ha.fixture.test"].draft.roomDashboards, {});
    assert.deepEqual(
      reconciled["https://ha.fixture.test"].published.roomDashboards,
      profile.roomDashboards,
    );
    for (const patch of [
      { view: "https://other.fixture.test/view" },
      { view: "/home/overview?token=secret" },
      { appearance: "unknown" },
      { extra: "secret" },
    ]) {
      assert.equal(
        engine.validateRuntimeBindingProfile(
          { ...profile, roomDashboards: { [roomId]: { ...settings, ...patch } } },
          manifest,
        ).valid,
        false,
      );
    }
    assert.equal(
      engine.validateRuntimeBindingProfile(
        { ...profile, roomDashboards: { deleted: settings } },
        manifest,
      ).valid,
      false,
    );
  });

  test("dashboard discovery includes hidden dashboards, numeric view paths, and partial failures without guessing room names", async () => {
    const calls = [];
    const send = async (message) => {
      calls.push(message);
      if (message.type === "get_panels")
        return {
          home: { component_name: "home" },
          lovelace: { component_name: "lovelace", title: "Main" },
        };
      if (message.type === "lovelace/dashboards/list")
        return [
          { url_path: "dashboard-hidden", title: "Tablet" },
          { url_path: "dashboard-denied", title: "Private" },
        ];
      if (message.url_path === "dashboard-denied") throw Error("forbidden");
      return { views: [{ title: "Kitchen", path: "kitchen" }, { title: "Second" }] };
    };
    const result = await discoverDashboardViews(send, "https://ha.fixture.test");
    assert.equal(result.automatic, true);
    assert.ok(
      result.views.some(
        (view) => view.path === "/dashboard-hidden/kitchen" && view.label === "Tablet → Kitchen",
      ),
    );
    assert.ok(result.views.some((view) => view.path === "/lovelace/1"));
    assert.ok(result.error);
    assert.ok(
      calls.every((message) =>
        ["get_panels", "lovelace/dashboards/list", "lovelace/config"].includes(message.type),
      ),
    );
    const unavailable = await discoverDashboardViews(
      async (message) => (message.type === "get_panels" ? {} : []),
      "https://ha.fixture.test",
    );
    assert.equal(unavailable.automatic, false);
    const generated = await discoverDashboardViews(async (message) => {
      if (message.type === "get_panels")
        return { map: { component_name: "lovelace", title: "Map" } };
      if (message.type === "lovelace/dashboards/list") return [];
      throw { code: "config_not_found", message: "No config found." };
    }, "https://ha.fixture.test");
    assert.deepEqual(generated.views, [{ path: "/map/0", label: "Map → Default view" }]);
    assert.equal(generated.error, null);
    const overview = await discoverDashboardViews(async (message) => {
      if (message.type === "get_panels")
        return { home: { component_name: "home" }, lovelace: { component_name: "lovelace" } };
      if (message.type === "lovelace/dashboards/list") return [];
      throw { code: "config_not_found" };
    }, "https://ha.fixture.test");
    assert.deepEqual(overview.views, [
      { path: "/home/overview", label: "Overview → Default view" },
    ]);
  });

  test("embedded appearance styles late shadow roots and fully restores the original document on teardown", async () => {
    const dom = new JSDOM("<!doctype html><home-assistant></home-assistant>", {
      pretendToBeVisual: true,
    });
    const doc = dom.window.document;
    const host = doc.querySelector("home-assistant").attachShadow({ mode: "open" });
    host.innerHTML = "<hui-view></hui-view>";
    let ready = 0;
    const detach = attachDashboardAppearance(doc, true, () => ready++);
    try {
      assert.equal(ready, 1);
      assert.match(host.querySelector("style").textContent, /--ha-card-background/);
      const card = doc.createElement("fixture-card");
      host.append(card);
      const shadow = card.attachShadow({ mode: "open" });
      shadow.innerHTML = "<button>Existing action</button>";
      await waitForAsyncCondition(() => shadow.querySelector("style"));
      assert.equal(shadow.querySelector("button").textContent, "Existing action");
      detach();
      assert.equal(shadow.querySelector("style"), null);
      assert.equal(host.querySelector("style"), null);
      assert.equal(doc.querySelector("style"), null);
      const detachOriginal = attachDashboardAppearance(doc, false, () => {});
      assert.doesNotMatch(host.querySelector("style").textContent, /--ha-card-background/);
      detachOriginal();
    } finally {
      detach();
      dom.window.close();
    }
  });
});
