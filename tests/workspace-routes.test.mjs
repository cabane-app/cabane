import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const {
    editorPath,
    agentPilotPath,
    agentPilotRequested,
    editorRequestForPath,
    workspaceHomePath,
    workspaceIdForPath,
    shouldFlushEditorExit,
  } = await load("/apps/web/src/editor-routes.ts");
  const { parseEditorReturn } = await load("/apps/web/src/editor-connect/connect-navigation.ts");
  test("workspace editor routes preserve identity across every editor mode", () => {
    assert.deepEqual(editorRequestForPath("/build"), { mode: "construct" });
    assert.equal(workspaceIdForPath("/build"), null);
    for (const request of [
      { mode: "construct" },
      { mode: "furnish" },
      { mode: "connect" },
      { mode: "connect", view: "rooms" },
      { mode: "connect", view: "devices" },
    ]) {
      const path = editorPath(request, "home-a");
      assert.deepEqual(editorRequestForPath(path), request);
      assert.equal(workspaceIdForPath(path), "home-a");
    }
    assert.equal(
      editorPath({ mode: "connect", relationshipId: "lamp" }, "home-b"),
      "/workspaces/home-b/connect/devices",
    );
    assert.equal(workspaceHomePath("home a"), "/workspaces/home%20a");
    assert.equal(workspaceIdForPath("/workspaces/home%20a/construct"), "home a");
    for (const path of [
      "/construct",
      "/arrange",
      "/connect",
      "/connect/devices",
      "/workspaces",
      "/",
    ])
      assert.equal(editorRequestForPath(path), null);
  });
  test("leaving the editor saves when switching workspace even between matching modes", () => {
    assert.equal(shouldFlushEditorExit("home-a", "/workspaces/home-a/arrange"), false);
    assert.equal(shouldFlushEditorExit("home-a", "/workspaces/home-a/connect/devices"), false);
    for (const path of [
      "/workspaces/home-b/construct",
      "/workspaces/home-b/connect",
      "/workspaces/home-a",
      "/workspaces",
      "/",
    ]) {
      assert.equal(shouldFlushEditorExit("home-a", path), true);
    }
  });
  test("Home Assistant OAuth returns to its section inside editor Settings", () => {
    const request = parseEditorReturn(
      JSON.stringify({ workspaceId: "home-a", mode: "connect", panel: "home-assistant" }),
    );
    assert.equal(
      editorPath(request, request.workspaceId),
      "/workspaces/home-a/settings/home-assistant",
    );
    assert.deepEqual(editorRequestForPath("/workspaces/home-a/home-assistant"), {
      mode: "construct",
      panel: "settings",
      settingsSection: "home-assistant",
    });
    assert.equal(shouldFlushEditorExit("home-a", "/workspaces/home-a/home-assistant"), false);
    assert.equal(workspaceIdForPath("/workspaces/home-a/home-assistant"), "home-a");
  });
  test("OAuth preserves close Arrange views and rejects invalid zoom", () => {
    const camera = { view: "3d", position: [3, 8, 3], target: [0, 0.2, 0], zoom: 300 };
    const request = {
      workspaceId: "close-view",
      mode: "connect",
      arrange: { selectedItemId: "sensor", camera },
    };
    assert.deepEqual(parseEditorReturn(JSON.stringify(request)).arrange.camera, camera);
    request.arrange.camera = { ...camera, zoom: 6 };
    assert.equal(parseEditorReturn(JSON.stringify(request)).arrange.camera.zoom, 6);
    for (const zoom of [301, 5, null]) {
      request.arrange.camera = { ...camera, zoom };
      assert.equal(parseEditorReturn(JSON.stringify(request)).arrange.camera, undefined);
    }
  });

  test("action bar customization is a refreshable editor panel route", () => {
    const path = editorPath({ mode: "construct", panel: "action-bar" }, "home-a");
    assert.equal(path, "/workspaces/home-a/settings/shortcuts");
    assert.deepEqual(editorRequestForPath(path), {
      mode: "construct",
      panel: "settings",
      settingsSection: "shortcuts",
    });
    assert.deepEqual(editorRequestForPath("/workspaces/home-a/action-bar"), {
      mode: "construct",
      panel: "settings",
      settingsSection: "shortcuts",
    });
    for (const section of [
      "home-assistant",
      "shortcuts",
      "backups",
      "orbital-view",
      "editor",
      "explore",
    ]) {
      const request = { mode: "construct", panel: "settings", settingsSection: section };
      const sectionPath = editorPath(request, "home-a");
      assert.deepEqual(editorRequestForPath(sectionPath), request);
      assert.equal(shouldFlushEditorExit("home-a", sectionPath), false);
      assert.equal(shouldFlushEditorExit("home-b", sectionPath), true);
    }
    assert.deepEqual(editorRequestForPath("/workspaces/home-a/shortcuts"), {
      mode: "construct",
      panel: "settings",
      settingsSection: "shortcuts",
    });
    assert.equal(shouldFlushEditorExit("home-a", "/workspaces/home-a"), true);
    assert.equal(shouldFlushEditorExit("home-a", "/workspaces/home-a/construct"), false);
  });
  test("agent pilot opens only when requested by the workspace menu", () => {
    assert.equal(agentPilotPath("home-a"), "/workspaces/home-a/construct?agent-pilot=1");
    assert.equal(agentPilotRequested("?agent-pilot=1"), true);
    assert.equal(agentPilotRequested(""), false);
    assert.equal(agentPilotRequested("?agent-pilot=0"), false);
  });
});
