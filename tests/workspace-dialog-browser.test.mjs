import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { scopePanelCss } from "../scripts/panel-build-tools.mjs";
import { withBrowserDiagnostics } from "./browser-test-diagnostics.mjs";
import { createBrowserTestSession } from "./browser-test-environment.mjs";

// Browser-only risk: native input colors follow HA's inherited color-scheme
// through the panel shadow root, even when the dialog has its own light palette.
test(
  "workspace name stays readable inside light and dark Home Assistant hosts",
  { timeout: 10_000 },
  withBrowserDiagnostics(async () => {
    const { css } = scopePanelCss(
      await readFile(new URL("../apps/web/src/workspaces/workspaces.css", import.meta.url), "utf8"),
    );
    const browser = await createBrowserTestSession();
    try {
      const page = await browser.newPage();
      await page.setContent("<cabane-panel></cabane-panel>");
      await page.evaluate((css) => {
        const shadow = document.querySelector("cabane-panel").attachShadow({ mode: "open" });
        const style = document.createElement("style");
        style.textContent = css;
        shadow.append(style);
        const dialog = document.createElement("dialog");
        dialog.className = "workspace-dialog";
        dialog.innerHTML = '<label>Workspace name<input value="My home"></label>';
        shadow.append(dialog);
        dialog.showModal();
      }, css);
      for (const scheme of ["light", "dark"]) {
        await page.evaluate((scheme) => {
          document.documentElement.style.colorScheme = scheme;
        }, scheme);
        const colors = await page.getByLabel("Workspace name").evaluate((input) => {
          const { color, backgroundColor } = getComputedStyle(input);
          const luminance = (value) => {
            const [r, g, b] = value
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number)
              .map((channel) => {
                const srgb = channel / 255;
                return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
              });
            return r * 0.2126 + g * 0.7152 + b * 0.0722;
          };
          const foreground = luminance(color);
          const background = luminance(backgroundColor);
          return {
            color,
            backgroundColor,
            contrast:
              (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
          };
        });
        assert.ok(colors.contrast >= 4.5, `${scheme} host: ${JSON.stringify(colors)}`);
      }
    } finally {
      await browser.close();
    }
  }),
);
