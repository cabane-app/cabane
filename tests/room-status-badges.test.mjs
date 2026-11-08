import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { RoomStatusBadges, roomStatusAccessibleText } = await load(
    "/packages/engine/src/room-status/RoomStatusBadges.tsx",
  );
  const summary = {
    roomId: "demo-room",
    temperature: { value: "21.4", unit: "°C" },
    humidity: { value: "48", unit: "%" },
    aqi: { value: "42", unit: null },
    co2: { value: "820", unit: "ppm" },
    noise: { value: "41.5", unit: "dBA" },
    heating: true,
    cooling: false,
    lighting: "on",
    presence: "absent",
    doorOpen: true,
  };

  test("renders complete labels in stable order for the detailed hero variant", () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomStatusBadges, {
        summary,
        variant: "detailed",
      }),
    );
    const order = [
      "21.4 °C",
      "48 %",
      "AQI 42",
      'room-status-badge__label">820 ppm<',
      'room-status-badge__label">41.5 dBA<',
      "Heating",
      "Lights on",
      "No presence",
      "Door open",
    ];
    order.reduce((previous, text) => {
      const index = html.indexOf(text);
      assert.ok(index > previous, `${text} should follow the previous status`);
      return index;
    }, -1);
    assert.equal(html.includes("Cooling"), false);
    assert.equal((html.match(/<svg/g) ?? []).length, 9);
  });

  test("keeps only readings visible in compact mode while preserving accessible labels", () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomStatusBadges, {
        summary,
        variant: "compact",
      }),
    );
    assert.match(html, /21.4 °C/);
    assert.match(html, /48 %/);
    assert.match(html, /aria-label="Heating"/);
    assert.match(html, /aria-label="Lights on"/);
    assert.match(html, /aria-label="No presence"/);
    assert.match(html, /aria-label="Door open"/);
  });

  test("returns no group for an empty summary and builds concise overlay text", () => {
    const empty = {
      roomId: "empty",
      heating: false,
      cooling: false,
      doorOpen: false,
    };
    assert.equal(
      renderToStaticMarkup(
        React.createElement(RoomStatusBadges, {
          summary: empty,
          variant: "compact",
        }),
      ),
      "",
    );
    assert.equal(
      roomStatusAccessibleText(summary),
      "Temperature 21.4 °C, Humidity 48 %, Air quality index 42, Carbon dioxide 820 ppm, Noise 41.5 dBA, Heating, Lights on, No presence, Door open",
    );
  });
});
