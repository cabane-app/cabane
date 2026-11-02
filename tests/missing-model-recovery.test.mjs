import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { create } from "@react-three/test-renderer";
import { withModules } from "./test-server.mjs";
import { withStorageDom } from "./dom-test-environment.mjs";

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { CabaneDashboard } = await load("/packages/engine/src/CabaneDashboard.tsx");
  const { CabaneApp } = await load("/packages/engine/src/CabaneApp.tsx");
  const { LegacyDeviceItemRenderer } = await load("/packages/engine/src/SceneItemRenderer.tsx");
  const { stableArchitectureModelRegistry } = await load(
    "/packages/catalog/src/architecture/index.ts",
  );
  const { interactionFloor: floor } = await load("/tests/fixtures/interaction-floor.ts");
  const { collectConstructContextualIssues, visibleConstructIssues } = await load(
    "/apps/web/src/editor-preview/construct/contextual-validation.ts",
  );
  const registries = {
    furnishingModels: {},
    deviceModels: {},
    roomFurnishings: {},
    openingModels: {},
  };
  const fixture = () => {
    const project = {
      ...engine.createEmptyHomeProject("missing-models", "Missing models"),
      coordinates: floor.coordinates,
      floors: [structuredClone(floor)],
      sceneItems: ["missing-chair", "oak-wall-uplight", "future-lamp"].map((modelId, index) => ({
        id: `item-${index}`,
        floorId: floor.id,
        kind: index === 0 ? "furnishing" : "device",
        modelId,
        size: [0.3, 0.4, 0.2],
        placement: {
          kind: "absolute",
          at: engine.polygonCentroid(floor.rooms[0].polygon),
          elevationMeters: 0.5,
          rotationYRadians: 0.4,
        },
        ...(index === 0
          ? {}
          : {
              entitySlots: [
                {
                  id: `slot-${index}`,
                  deviceRole: "primary",
                  compatibleDomains: ["light"],
                  required: true,
                  autoMap: "manual",
                  presentation: { label: "Lamp", dashboardRole: "primary" },
                },
              ],
            }),
      })),
    };
    project.sceneItems[1].placement = {
      kind: "wall",
      wallId: floor.walls[0].id,
      face: "right",
      offsetFromWallStartPlanUnits: 2,
      elevationMeters: 1,
      depthOffsetMeters: 0.15,
      rotationOffsetRadians: 0,
    };
    project.sceneItems[2].placement = {
      kind: "ceiling",
      roomId: floor.rooms[0].id,
      at: engine.polygonCentroid(floor.rooms[0].polygon),
      dropMeters: 0.5,
      rotationYRadians: 0.7,
    };
    return project;
  };

  test("missing models survive composition and validation with placements and connections intact", async () => {
    const project = fixture();
    const original = structuredClone(project);
    const checked = engine.validateHomeProject(project, registries);
    assert.equal(checked.valid, true, JSON.stringify(checked.issues));
    const manifest = engine.composeHomeManifest(project, registries);
    const validation = engine.validateHomeManifest(manifest, registries);
    assert.equal(validation.canRender, true, JSON.stringify(validation.issues));
    assert.ok(validation.issues.every((issue) => issue.severity === "warning"));
    assert.deepEqual(validation.manifest.sceneItems, original.sceneItems);
    const profile = {
      ...engine.createEmptyRuntimeBindingProfile(project.home.id),
      entityIdsBySlotId: { "slot-1": "light.fixture_one", "slot-2": "light.fixture_two" },
    };
    assert.equal(engine.validateRuntimeBindingProfile(profile, manifest).valid, true);
    assert.deepEqual(project, original);

    const issues = collectConstructContextualIssues({
      project,
      floor: project.floors[0],
      projectIssues: checked.issues,
    });
    for (const tool of [null, "select"]) {
      const visible = visibleConstructIssues(issues, tool);
      for (const item of project.sceneItems) {
        const issue = visible.find((issue) => issue.target?.id === item.id);
        assert.equal(issue?.severity, "warning");
        assert.match(issue.suggestion, /Update Cabane in HACS/);
      }
    }

    const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      const renderer = await create(
        React.createElement(
          "group",
          {},
          ...project.sceneItems.map((item) =>
            React.createElement(engine.SceneItemRenderer, {
              key: item.id,
              item,
              floor: project.floors[0],
              ...registries,
              entityStatesBySlotId: {},
              reducedMotion: true,
              walkMode: false,
              onInteract() {},
              liveMediaByEntityId: {},
            }),
          ),
        ),
      );
      try {
        for (const item of project.sceneItems) {
          const placeholder = renderer.scene.findByProps({ name: `missing-model-${item.id}` });
          assert.deepEqual(placeholder.props.userData, { missingModelId: item.modelId });
          assert.deepEqual(placeholder.instance.geometry.parameters, {
            width: item.size[0],
            height: item.size[1],
            depth: item.size[2],
            widthSegments: 1,
            heightSegments: 1,
            depthSegments: 1,
          });
          const group = renderer.scene.findByProps({ name: `scene-item-${item.id}` });
          assert.deepEqual(
            group.props.position,
            engine.resolveItemTransform(item.placement, floor).position,
          );
        }
      } finally {
        await renderer.unmount();
      }
      const device = manifest.floors[0].rooms[0].devices[0];
      const legacy = await create(
        React.createElement(LegacyDeviceItemRenderer, {
          resolvedDevice: { slot: device, entities: [], issues: [] },
          floor: manifest.floors[0],
          definition: undefined,
          reducedMotion: true,
          walkMode: false,
          onInteract() {},
          liveMediaByEntityId: {},
        }),
      );
      try {
        assert.ok(legacy.scene.findByProps({ name: `missing-model-${device.id}` }));
      } finally {
        await legacy.unmount();
      }
    } finally {
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    }
    const broken = structuredClone(manifest);
    broken.floors[0].rooms[0].polygon[0] = [Number.NaN, 0];
    assert.equal(engine.validateHomeManifest(broken, registries).canRender, false);
    const unsupported = structuredClone(project);
    unsupported.sceneItems[1].placement.wallId = "missing-wall";
    assert.equal(engine.validateHomeProject(unsupported, registries).valid, false);
  });

  test("blocking dashboard screens keep recovery actions and collapse technical details", async () => {
    const manifest = engine.composeHomeManifest(fixture(), registries);
    manifest.floors[0].rooms[0].polygon[0] = [Number.NaN, 0];
    for (const [Component, architectureModels] of [
      [CabaneDashboard, stableArchitectureModelRegistry],
      [CabaneDashboard, {}],
      [CabaneApp, stableArchitectureModelRegistry],
    ]) {
      await withStorageDom(async ({ document, click }) => {
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);
        let opened = 0;
        let downloads = 0;
        await act(async () =>
          root.render(
            React.createElement(Component, {
              manifest,
              architectureModels,
              onWorkspaces: () => opened++,
              onExportBrowserData: async () => {
                if (++downloads === 1) throw new Error("Backup unavailable");
              },
            }),
          ),
        );
        try {
          assert.equal(document.querySelector("details")?.open, false);
          assert.match(document.body.textContent, /Update Cabane in HACS/);
          await click("Workspaces");
          assert.equal(opened, 1);
          if (Component === CabaneDashboard) {
            await click("Download backup");
            assert.equal(downloads, 1);
            assert.match(
              document.querySelector('[role="alert"]').textContent,
              /Backup unavailable/,
            );
            await click("Download backup");
            assert.equal(downloads, 2);
            assert.equal(document.querySelector('[role="alert"]'), null);
          } else
            assert.ok(
              [...document.querySelectorAll("button")].some(
                (button) => button.textContent === "Download backup",
              ),
            );
          assert.equal(document.querySelector("details")?.open, false);
        } finally {
          await act(async () => root.unmount());
        }
      });
    }
  });
});
