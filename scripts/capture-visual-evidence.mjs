import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { waitForSceneCamera } from "./browser-scene-settle.mjs";
import { startFixtureServer, serverOrigin } from "./fixture-server.mjs";

const argument = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const fixture = argument("--fixture");
const requestedStage = argument("--stage");
const requestedRoomId = argument("--room-id");
const fixtureMode = Boolean(fixture);
const ownerHomeId = fixtureMode
  ? null
  : JSON.parse(await readFile(resolve(process.cwd(), "home/showcase/atelier.project.json"), "utf8"))
      .home.id;
if (!fixtureMode && !ownerHomeId) {
  throw new Error("Could not determine the owner home ID for visual evidence.");
}
const stages = requestedStage ? [requestedStage] : ["layout", "room"];
if (stages.some((stage) => !["layout", "room"].includes(stage))) {
  throw new Error("Evidence stage must be layout or room.");
}
if (!fixtureMode && stages.includes("room") && !requestedRoomId) {
  throw new Error("Owner room evidence requires --room-id <id>.");
}

const outputDirectory = resolve(process.cwd(), "screenshots/phase-4");
await mkdir(outputDirectory, { recursive: true });
const server = await startFixtureServer({ port: 4175, fixture: fixtureMode });
let browser;

const captures = [];
const viewports = {
  desktop: { width: 1440, height: 960 },
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
};

const capture = async ({
  stage,
  scenario,
  mode,
  viewport,
  name,
  deviceLabel,
  grazing = false,
  wallFadeEnabled = true,
  dayMode = false,
  bindingSetup = false,
}) => {
  const roomId = fixtureMode ? "fixture-studio" : requestedRoomId;
  const context = await browser.newContext({
    viewport: viewports[viewport],
    hasTouch: mode === "walk",
  });
  await context.addInitScript(
    ({ nextMode, selectedRoomId, fade, onboardingKey, modelingNudgeKey }) => {
      window.sessionStorage.setItem(
        "cabane-scene-session",
        JSON.stringify({
          mode: nextMode,
          selectedRoomId: nextMode === "overview" ? null : selectedRoomId,
          wallFadeEnabled: fade,
        }),
      );
      if (onboardingKey) window.localStorage.setItem(onboardingKey, "complete");
      if (modelingNudgeKey) window.localStorage.setItem(modelingNudgeKey, "complete");
    },
    {
      nextMode: mode === "walk" ? "overview" : mode,
      selectedRoomId: roomId,
      fade: wallFadeEnabled,
      onboardingKey: ownerHomeId ? `cabane:onboarding:v1:${ownerHomeId}` : null,
      modelingNudgeKey: ownerHomeId ? `cabane:modeling-nudge:v1:${ownerHomeId}` : null,
    },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      errors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
      errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  const origin = serverOrigin(server);
  const path = fixtureMode ? `/tests/agent-harness.html?stage=${stage}&scenario=${scenario}` : "/";
  await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
  if (fixtureMode) await page.locator("html[data-evidence-ready='true']").waitFor();
  await page.locator(".cabane-shell").waitFor();
  if (dayMode) {
    await page.getByLabel("Open scene menu").click();
    await page.getByRole("button", { name: "Bright day" }).click();
    await page.getByLabel("Open scene menu").click();
  }
  if (mode === "walk") {
    await page.getByRole("button", { name: "Walk mode" }).click();
    await page.getByText("Walking in", { exact: true }).waitFor();
  }
  if (bindingSetup) {
    await page.getByLabel("Open scene menu").click();
    await page.getByRole("button", { name: "Connect home to Home Assistant" }).click();
    await page.getByLabel("Connect your home").waitFor();
  }
  if (deviceLabel) {
    await page.getByRole("button", { name: new RegExp(deviceLabel, "i") }).click();
    await page.getByText("Device", { exact: true }).waitFor();
  }
  if (grazing) {
    const box = await page.locator("canvas").boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.48);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.5, { steps: 12 });
      await page.mouse.up();
    }
  }
  await waitForSceneCamera(page, mode === "walk" ? "PerspectiveCamera" : "OrthographicCamera");
  if (errors.length > 0) throw new Error(`${name}: ${errors.join("\n")}`);
  const file = resolve(outputDirectory, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  captures.push({ name, stage, scenario, mode, viewport, file });
  await context.close();
};

try {
  browser = await chromium.launch({
    channel: "chromium",
    headless: true,
    args: ["--use-angle=swiftshader"],
  });
  for (const stage of stages) {
    if (stage === "layout") {
      await capture({
        stage,
        scenario: "disconnected",
        mode: "overview",
        viewport: "desktop",
        name: "layout-desktop-solid",
        wallFadeEnabled: false,
        dayMode: true,
      });
      await capture({
        stage,
        scenario: "disconnected",
        mode: "overview",
        viewport: "desktop",
        name: "layout-desktop-faded",
        wallFadeEnabled: true,
        dayMode: true,
      });
      await capture({
        stage,
        scenario: "disconnected",
        mode: "overview",
        viewport: "portrait",
        name: "layout-portrait-solid",
        wallFadeEnabled: false,
        dayMode: true,
      });
      await capture({
        stage,
        scenario: "disconnected",
        mode: "overview",
        viewport: "portrait",
        name: "layout-portrait-faded",
        wallFadeEnabled: true,
        dayMode: true,
      });
      await capture({
        stage,
        scenario: "disconnected",
        mode: "overview",
        viewport: "landscape",
        name: "layout-landscape-solid",
        wallFadeEnabled: false,
        dayMode: true,
      });
      await capture({
        stage,
        scenario: "disconnected",
        mode: "overview",
        viewport: "landscape",
        name: "layout-landscape-faded",
        wallFadeEnabled: true,
        dayMode: true,
      });
      await capture({
        stage,
        scenario: "disconnected",
        mode: "walk",
        viewport: "desktop",
        name: "layout-desktop-walk",
      });
      await capture({
        stage,
        scenario: "disconnected",
        mode: "overview",
        viewport: "desktop",
        name: "layout-junction-grazing",
        grazing: true,
        wallFadeEnabled: false,
        dayMode: true,
      });
    } else {
      await capture({
        stage,
        scenario: "disconnected",
        mode: "overview",
        viewport: "desktop",
        name: "room-disconnected-overview",
      });
      await capture({
        stage,
        scenario: "disconnected",
        mode: "room",
        viewport: "desktop",
        name: "room-disconnected-focus",
      });
      await capture({
        stage,
        scenario: "disconnected",
        mode: "walk",
        viewport: "desktop",
        name: "room-disconnected-walk",
      });
      await capture({
        stage,
        scenario: "disconnected",
        mode: "room",
        viewport: "desktop",
        name: "room-wall-contact-grazing",
        grazing: true,
      });
      if (fixtureMode) {
        await capture({
          stage,
          scenario: "connected",
          mode: "room",
          viewport: "desktop",
          name: "room-connected-device",
          deviceLabel: "Speaker",
        });
        await capture({
          stage,
          scenario: "connected",
          mode: "room",
          viewport: "portrait",
          name: "room-connected-portrait",
        });
        await capture({
          stage,
          scenario: "connected",
          mode: "room",
          viewport: "landscape",
          name: "room-connected-landscape",
          deviceLabel: "Speaker",
        });
        await capture({
          stage,
          scenario: "connected",
          mode: "room",
          viewport: "desktop",
          name: "runtime-bindings-desktop",
          bindingSetup: true,
        });
        await capture({
          stage,
          scenario: "connected",
          mode: "room",
          viewport: "portrait",
          name: "runtime-bindings-portrait",
          bindingSetup: true,
        });
        await capture({
          stage,
          scenario: "connected",
          mode: "room",
          viewport: "landscape",
          name: "runtime-bindings-landscape",
          bindingSetup: true,
        });
        await capture({
          stage,
          scenario: "unavailable",
          mode: "room",
          viewport: "desktop",
          name: "room-unavailable",
        });
      }
    }
  }
  await writeFile(
    resolve(outputDirectory, "evidence.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), captures }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Captured ${captures.length} normal-UI views in ${outputDirectory}.`);
  console.log(
    stages.includes("room")
      ? `ROOM_REVIEW_REQUIRED:${fixtureMode ? "fixture-studio" : requestedRoomId}`
      : "LAYOUT_REVIEW_REQUIRED",
  );
} finally {
  await browser?.close();
  await server.close();
}
