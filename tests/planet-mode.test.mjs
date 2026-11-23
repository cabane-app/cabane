import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

await withModules(async (load) => {
  const { ScenePreferences } = await load("/packages/engine/src/ScenePreferences.tsx");
  test("Planet mode preserves each home's old preference and responds to storage changes", () =>
    withStorageDom(async ({ document, window, mount }) => {
      const key = (home) => `cabane.landscape.v1:${home}`;
      window.localStorage.setItem(key("country"), "countryside");
      window.localStorage.setItem(key("city"), "new-york");
      window.localStorage.setItem(key("plain"), "none");
      const root = createRoot(document.body);
      const render = (homeId, section = "orbital-view") =>
        root.render(createElement(ScenePreferences, { homeId, section }));
      await mount(() => {
        render("country");
        return { unmount: () => root.unmount() };
      });
      const toggle = () =>
        [...document.querySelectorAll("label")].find((label) =>
          label.textContent.includes("Planet mode"),
        )?.control;
      assert.equal(toggle().checked, true);
      for (const home of ["city", "plain", "new"]) {
        await act(() => render(home));
        assert.equal(toggle().checked, false);
      }
      await act(() => toggle().click());
      assert.equal(toggle().checked, true);
      assert.equal(window.localStorage.getItem(key("new")), "true");
      assert.equal(window.localStorage.getItem(key("country")), "countryside");
      await act(() => {
        window.localStorage.setItem(key("new"), "false");
        window.dispatchEvent(new window.StorageEvent("storage", { key: key("new") }));
      });
      assert.equal(toggle().checked, false);
      for (const section of ["editor", "explore"]) {
        await act(() => render("country", section));
        assert.equal(toggle(), undefined);
      }
    }));
});
