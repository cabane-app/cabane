import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

await withModules(async (load) => {
  const { ModelGenerationGuide } = await load(
    "/apps/web/src/custom-models/ModelGenerationGuide.tsx",
  );
  for (const clipboard of ["available", "missing", "rejected"])
    test(`model guide handles ${clipboard} clipboard and restores keyboard focus`, () =>
      withStorageDom(async (dom) => {
        const opener = dom.document.createElement("button");
        dom.document.body.append(opener);
        opener.focus();
        let copied;
        if (clipboard !== "missing")
          Object.defineProperty(dom.window.navigator, "clipboard", {
            value: {
              async writeText(text) {
                if (clipboard === "rejected") throw new Error("Permission denied");
                copied = text;
              },
            },
          });
        await dom.mount(async () => {
          const container = dom.document.createElement("div");
          dom.document.body.append(container);
          const root = createRoot(container);
          root.render(
            React.createElement(ModelGenerationGuide, {
              onClose: () => root.render(null),
              onImport() {},
            }),
          );
          return {
            unmount: () => {
              root.unmount();
              container.remove();
            },
          };
        });
        const command = "npx skills add cabane-app/cabane --skill create-cabane-model";
        assert.equal(dom.document.querySelector("pre code").textContent, command);
        assert.equal(
          dom.document.querySelector("a").href,
          "https://github.com/cabane-app/cabane/tree/main/.agents/skills/create-cabane-model",
        );
        await dom.click("Copy command");
        if (clipboard === "available") {
          await dom.until(() => dom.button("Copied"));
          assert.equal(copied, command);
        } else
          await dom.until(() =>
            dom.document.querySelector('[role="status"]')?.textContent.includes("Select and copy"),
          );
        await act(async () =>
          dom.document
            .querySelector("dialog")
            .dispatchEvent(new dom.window.Event("cancel", { bubbles: true, cancelable: true })),
        );
        assert.equal(dom.document.querySelector("dialog"), null);
        assert.equal(dom.document.activeElement, opener);
      }));
});
