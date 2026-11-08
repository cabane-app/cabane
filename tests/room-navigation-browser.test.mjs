import assert from "node:assert/strict";
import test from "node:test";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession, getBrowserTestServer } from "./browser-test-environment.mjs";

const fixture = `<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<div id="root"></div>
<script type="module">
import React from "react";
import { createRoot } from "react-dom/client";
import { DashboardLocation } from "/packages/engine/src/room-navigation/DashboardLocation.tsx";
import "/packages/engine/src/styles.css";

const h = React.createElement;
const floor = { id: "ground", name: "Ground floor", rooms: [{ id: "kitchen", name: "Kitchen" }] };
const outsideRoom = { id: "outside", name: "Outside rooms" };
function Dashboard() {
  const [selectedRoomId, selectRoom] = React.useState(null);
  const [deviceOverlay, setDeviceOverlay] = React.useState(false);
  const mode = selectedRoomId ? "room" : "overview";
  const dashboard = {
    floor, manifest: { floors: [floor] }, floorNavigation: { wholeBuilding: false, selectFloor() {} },
    mode, selectedRoomId, selectRoom, selectedRoomDisplayName: "Kitchen", goHome: () => selectRoom(null),
    roomDisplayNames: {}, roomStatuses: {}, reducedMotion: true, outsideRoom, deviceOverlay,
    openDevicePanel: (id) => setDeviceOverlay(id === outsideRoom.id),
    runtime: { status: "connected", areas: [] }, bindingManager: { profile: { roomAreaIds: {} } },
  };
  return h("main", { className: "cabane-shell mode-" + mode }, [
    h("header", { key: "hud", className: "scene-hud" },
      h(DashboardLocation, { dashboard }),
      h("details", { className: "scene-menu" },
        h("summary", { "aria-label": "More options" }, "⋯"))),
    deviceOverlay && h("button", { key: "close", onClick: () => setDeviceOverlay(false) }, "Close device controls"),
  ]);
}
createRoot(document.getElementById("root")).render(h(Dashboard));
</script>`;

// The container breakpoint and focus on a visible trigger after remount need real CSS and native focus.
test(
  "dashboard room navigation stays usable when a desktop window narrows to 320px",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { server } = await getBrowserTestServer();
    const browser = await createBrowserTestSession();
    const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });
    const path = "/room-navigation-fixture.html";
    await page.route(`**${path}`, async (route) =>
      route.fulfill({
        contentType: "text/html",
        body: await server.transformIndexHtml(path, fixture),
      }),
    );
    await page.goto(new URL(path, server.resolvedUrls.local[0]).href);
    const floor = page.getByLabel("Ground floor", { exact: true });
    const rooms = page.getByRole("button", { name: "Rooms", exact: true });
    const choices = page.getByRole("group", { name: "Choose a room" });
    const kitchen = choices.getByRole("button", { name: "Kitchen", exact: true });
    await kitchen.click();
    assert.equal(await rooms.count(), 0);
    await page.setViewportSize({ width: 320, height: 700 });
    await rooms.click();
    const [floorBox, roomsBox, choicesBox] = await Promise.all([
      floor.boundingBox(),
      rooms.boundingBox(),
      choices.boundingBox(),
    ]);
    assert.ok(floorBox?.height >= 44 && roomsBox?.height >= 44);
    assert.ok(floorBox.x + floorBox.width <= roomsBox.x);
    assert.equal(
      await floor
        .locator("strong")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
      true,
    );
    assert.ok(choicesBox?.x >= 0 && choicesBox.x + choicesBox.width <= 320);
    assert.equal(await kitchen.getAttribute("aria-pressed"), "true");
    await choices.getByRole("button", { name: "Outside rooms" }).click();
    await page.getByRole("button", { name: "Close device controls" }).click();
    assert.equal(await rooms.getAttribute("aria-expanded"), "false");
    assert.equal(await rooms.evaluate((element) => document.activeElement === element), true);
    await floor.click();
    assert.equal(await floor.getAttribute("aria-expanded"), "true");
  }),
);
