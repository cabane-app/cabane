import assert from "node:assert/strict";
import test from "node:test";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { ArrangeCatalog } = await load(
    "/apps/web/src/editor-preview/furnish/catalog/ArrangeCatalog.tsx",
  );
  const { useHomeEditorController } = await load(
    "/apps/web/src/editor-workspace/useHomeEditorController.ts",
  );
  const { HomeEditorHeader } = await load("/apps/web/src/editor-workspace/HomeEditorHeader.tsx");
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
  const { createSeedProjectRecord, editCustomModel } = await load("/packages/engine/src/index.ts");
  const { ownerHomeProject, ownerProjectManifest } = await load("/tests/fixtures/bundled-home.ts");
  const { useConstructEditor } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );
  const { FurnishingInspector } = await load(
    "/apps/web/src/editor-preview/furnish/FurnishingInspector.tsx",
  );
  const { useFurnishingEditor } = await load(
    "/apps/web/src/editor-preview/furnish/useFurnishingEditor.ts",
  );

  const { ArrangePlacedItems } = await load(
    "/apps/web/src/editor-preview/furnish/ArrangePlacedItems.tsx",
  );
  const { useEditorPanels } = await load("/apps/web/src/editor-workspace/useEditorPanels.ts");

  async function withDom(run) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://cabane.local/" });
    const names = [
      "window",
      "document",
      "navigator",
      "screen",
      "HTMLElement",
      "ResizeObserver",
      "IntersectionObserver",
      "addEventListener",
      "removeEventListener",
      "IS_REACT_ACT_ENVIRONMENT",
    ];
    dom.window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    dom.window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    const previous = Object.fromEntries(
      names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    );
    for (const name of names)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value:
          name === "IS_REACT_ACT_ENVIRONMENT"
            ? true
            : name.endsWith("EventListener")
              ? dom.window[name].bind(dom.window)
              : dom.window[name],
      });
    const root = createRoot(dom.window.document.getElementById("root"));
    try {
      await run({ root, document: dom.window.document, window: dom.window });
    } catch (error) {
      if (error instanceof AggregateError)
        throw new Error([...new Set(error.errors.map((entry) => entry.stack))].join("\n"), {
          cause: error,
        });
      throw error;
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      for (const name of names) {
        if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
        else delete globalThis[name];
      }
    }
  }

  test("placed items include occluded and missing models on this floor and open normal Properties without moving focus or editing history", async () => {
    await withDom(async ({ root, document }) => {
      const baseFloor = ownerProjectManifest.floors[0];
      const floor = {
        ...baseFloor,
        id: "synthetic-floor",
        rooms: [
          {
            ...baseFloor.rooms[0],
            id: "study",
            name: "Study",
            polygon: [
              [0, 0],
              [4, 0],
              [4, 4],
              [0, 4],
            ],
          },
          {
            ...baseFloor.rooms[0],
            id: "kitchen",
            name: "Kitchen",
            polygon: [
              [4, 0],
              [8, 0],
              [8, 4],
              [4, 4],
            ],
          },
        ],
        outdoorPlatforms: [
          {
            id: "patio",
            useAsRoom: true,
            roomName: "Patio",
            polygon: [
              [8, 0],
              [12, 0],
              [12, 4],
              [8, 4],
            ],
            finish: baseFloor.rooms[0].floorFinish,
          },
        ],
      };
      const placement = { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 };
      const cabinet = {
        id: "cabinet",
        floorId: floor.id,
        kind: "furnishing",
        modelId: "cabinet",
        size: [2, 2, 2],
        placement,
      };
      const device = {
        ...cabinet,
        id: "inside-cabinet",
        kind: "device",
        modelId: "sensor",
        size: [0.1, 0.1, 0.1],
        entitySlots: [],
      };
      const missing = {
        ...cabinet,
        id: "unresolved",
        modelId: "removed-model",
        placement: { kind: "wall", wallId: "missing-wall" },
      };
      const ceiling = {
        ...device,
        id: "ceiling-device",
        placement: {
          kind: "ceiling",
          roomId: "kitchen",
          at: [6, 2],
          dropMeters: 0.2,
          rotationYRadians: 0,
        },
      };
      const outdoor = { ...cabinet, id: "patio-item", placement: { ...placement, at: [10, 2] } };
      const items = [
        cabinet,
        device,
        missing,
        ceiling,
        outdoor,
        { ...cabinet, id: "upstairs", floorId: "other-floor" },
      ];
      const definition = {
        ...ownerProjectRegistries.furnishingModels["sectional-sofa"],
        label: "Cabinet",
      };
      let editor, panels, setDisabled;
      function Harness() {
        editor = useFurnishingEditor(items);
        panels = useEditorPanels(editor.selectedId, false);
        const [disabled, updateDisabled] = useState(false);
        setDisabled = updateDisabled;
        const registries = {
          furnishingModels: { cabinet: definition },
          deviceModels: { sensor: { ...definition, label: "Temperature sensor" } },
        };
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(ArrangePlacedItems, {
            ...registries,
            floor,
            items: editor.items,
            selectedIds: editor.selectedIds,
            disabled,
            onSelect: (id) => {
              editor.select(id);
              panels.openProperties();
            },
          }),
          panels.propertiesOpen &&
            React.createElement(FurnishingInspector, {
              ...registries,
              floor,
              items: editor.items,
              selectedId: editor.selectedId,
              onPlacementChange: editor.updatePlacement,
              onSizeChange: editor.updateSize,
              onClose: panels.collapseProperties,
            }),
        );
      }
      await act(async () => root.render(React.createElement(Harness)));
      const list = () => document.querySelector(".arrange-placed-items__groups");
      assert.equal(list().querySelectorAll("button").length, 5, "other floors are excluded");
      assert.deepEqual(
        [...list().querySelectorAll("h3")].map((heading) => heading.textContent),
        ["Study", "Kitchen", "Patio", "Outside rooms"],
      );
      assert.match(
        list().querySelector('ul[aria-label="Kitchen"]').textContent,
        /Temperature sensor/,
      );
      assert.match(list().querySelector('ul[aria-label="Patio"]').textContent, /Cabinet/);
      assert.match(
        list().querySelector('ul[aria-label="Outside rooms"]').textContent,
        /Missing model/,
      );
      assert.match(list().textContent, /Temperature sensor/);
      assert.match(list().textContent, /Missing model/);
      assert.doesNotMatch(list().textContent, /inside-cabinet|unresolved|removed-model/);
      await act(async () => editor.selectMany([cabinet.id, device.id]));
      assert.equal(list().querySelectorAll('[aria-pressed="true"]').length, 2);
      const hiddenItem = list().querySelectorAll("button")[1];
      document.querySelector("details").open = true;
      hiddenItem.focus();
      await act(async () => hiddenItem.click());
      assert.deepEqual(editor.selectedIds, [device.id]);
      assert.equal(document.activeElement, hiddenItem);
      assert.equal(
        document.querySelector("#editor-properties h2").textContent,
        "Temperature sensor",
      );
      await act(async () => panels.collapseProperties());
      assert.equal(document.querySelector("#editor-properties"), null);
      await act(async () => hiddenItem.click());
      assert.ok(
        document.querySelector("#editor-properties"),
        "reselecting reopens collapsed Properties",
      );
      assert.deepEqual(editor.items, items);
      assert.equal(editor.past.length, 0);
      await act(async () => setDisabled(true));
      assert.ok([...list().querySelectorAll("button")].every((button) => button.disabled));
    });
  });

  test("details show variants only for multiple choices and persist the selection", async () => {
    await withDom(async ({ root, document }) => {
      const sofa = {
        ...ownerHomeProject.sceneItems.find((item) => item.modelId === "sectional-sofa"),
        variant: "default",
      };
      let editor;
      function Harness({ multiple = true }) {
        editor = useFurnishingEditor([sofa]);
        const definition = ownerProjectRegistries.furnishingModels[sofa.modelId];
        return React.createElement(FurnishingInspector, {
          ...ownerProjectRegistries,
          furnishingModels: {
            [sofa.modelId]: {
              ...definition,
              variants: multiple ? definition.variants : [{ id: "default", label: "Classic" }],
            },
          },
          items: editor.items,
          selectedId: sofa.id,
          onPlacementChange: editor.updatePlacement,
          onSizeChange: editor.updateSize,
          onVariantChange: editor.updateVariant,
          onClose: () => {},
        });
      }
      await act(async () => root.render(React.createElement(Harness)));
      const choices = document.querySelector('[role="group"][aria-label="Variant"]');
      assert.deepEqual(
        [...choices.querySelectorAll("button")].map((button) => button.getAttribute("aria-label")),
        [
          "Sage cushions — left chaise (front view)",
          "Sage cushions — right chaise (front view)",
          "Classic — left chaise (front view)",
          "Cozy — left chaise (front view)",
          "Classic — right chaise (front view)",
          "Cozy — right chaise (front view)",
        ],
      );
      assert.equal(
        choices.querySelector('[aria-pressed="true"]').getAttribute("aria-label"),
        "Classic — left chaise (front view)",
      );
      await act(async () => {
        choices.querySelector('[aria-label="Cozy — right chaise (front view)"]').click();
      });
      assert.deepEqual(editor.items[0], { ...sofa, variant: "cozy-right" });
      await act(async () => root.render(React.createElement(Harness, { multiple: false })));
      assert.equal(document.querySelector('[role="group"][aria-label="Variant"]'), null);
    });
  });

  test("fabric picker preserves defaults and supports saved colors, history, duplication, and reset", async () => {
    const engine = await load("/packages/engine/src/index.ts");
    await withDom(async ({ root, document, window }) => {
      const sofa = ownerHomeProject.sceneItems.find((item) => item.modelId === "sectional-sofa");
      let editor;
      function Harness() {
        editor = useFurnishingEditor([sofa]);
        return React.createElement(FurnishingInspector, {
          ...ownerProjectRegistries,
          items: editor.items,
          selectedId: sofa.id,
          onPlacementChange: editor.updatePlacement,
          onSizeChange: editor.updateSize,
          onColorChange: editor.updateColor,
          onClose() {},
        });
      }
      await act(async () => root.render(React.createElement(Harness)));
      const definition = ownerProjectRegistries.furnishingModels[sofa.modelId];
      const input = document.querySelector('input[type="color"]');
      assert.equal(input.value, definition.defaultColor);
      assert.equal(editor.items[0].color, undefined);
      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(
          input,
          "#325a84",
        );
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
        input.dispatchEvent(new window.Event("change", { bubbles: true }));
      });
      assert.equal(editor.items[0].color, "#325a84");
      const project = {
        ...ownerHomeProject,
        sceneItems: ownerHomeProject.sceneItems.map((item) =>
          item.id === sofa.id ? editor.items[0] : item,
        ),
      };
      assert.equal(engine.parseHomeProject(JSON.stringify(project)).valid, true);
      assert.equal(engine.validateHomeProject(project, ownerProjectRegistries).valid, true);
      const invalid = structuredClone(project);
      invalid.sceneItems.find((item) => item.id === sofa.id).color = "red";
      assert.equal(engine.parseHomeProject(JSON.stringify(invalid)).valid, false);
      await act(async () => editor.undo());
      assert.deepEqual(editor.items[0], sofa);
      await act(async () => editor.redo());
      assert.equal(editor.items[0].color, "#325a84");
      await act(async () => editor.duplicate(sofa.id));
      assert.equal(editor.items[1].color, "#325a84");
      assert.notEqual(editor.items[1].id, sofa.id);
      const reset = [...document.querySelectorAll("button")].find(
        (button) => button.textContent === "Reset color",
      );
      await act(async () => reset.click());
      assert.equal(editor.items[0].color, undefined);
      assert.equal(document.querySelector('input[type="color"]').value, definition.defaultColor);
    });
  });

  test("light details offer all four states and update the editor", async () => {
    await withDom(async ({ root, document, window }) => {
      const storedLight = ownerHomeProject.sceneItems.find(
        (item) =>
          item.kind === "device" &&
          item.entitySlots.some(
            (slot) => slot.deviceRole === "primary" && slot.compatibleDomains.includes("light"),
          ),
      );
      assert.ok(storedLight);
      const light = { ...storedLight, lightState: undefined };
      let editor;
      function Harness() {
        editor = useFurnishingEditor([light]);
        return React.createElement(FurnishingInspector, {
          ...ownerProjectRegistries,
          items: editor.items,
          selectedId: light.id,
          onPlacementChange: editor.updatePlacement,
          onSizeChange: editor.updateSize,
          onLightStateChange: editor.updateLightState,
          onClose: () => {},
        });
      }
      await act(async () => root.render(React.createElement(Harness)));
      const select = [...document.querySelectorAll("select")].find((element) =>
        [...element.options].some((option) => option.value === "connected"),
      );
      assert.ok(select);
      assert.equal(select.value, "connected");
      assert.deepEqual(
        [...select.options].map((option) => option.textContent),
        ["Always off", "Always on", "Night only", "Connected"],
      );
      for (const mode of ["always-on", "night-only", "always-off", "connected"]) {
        await act(async () => {
          select.value = mode;
          select.dispatchEvent(new window.Event("change", { bubbles: true }));
        });
        assert.equal(editor.items[0].lightState, mode);
        assert.equal(select.value, mode);
      }
      await act(async () => editor.undo());
      assert.equal(select.value, "always-off");
    });
  });

  test("room navigation scopes the rendered catalog and selections emit reusable model entries", async () => {
    await withDom(async ({ root, document }) => {
      const chosen = [];
      let browse;
      function Harness() {
        const [browsing, onBrowse] = useState({ room: "all", query: "", view: "categories" });
        browse = onBrowse;
        return React.createElement(ArrangeCatalog, {
          ...ownerProjectRegistries,
          browsing,
          onBrowse,
          onChoose: (entry) => chosen.push(entry),
          enabled: false,
        });
      }
      await act(async () => root.render(React.createElement(Harness)));
      assert.ok(document.querySelector('[aria-label="Catalog categories"]'));
      assert.equal(document.querySelector(".catalog-grid"), null);
      const chooseRoom = async (name) => {
        await act(async () => document.querySelector(".catalog-navigation button")?.click());
        await act(async () =>
          document.querySelector(`.catalog-categories [aria-label="${name}"]`).click(),
        );
      };
      await chooseRoom("All items");
      assert.ok(document.querySelector('[aria-label="Add Television"]'));
      assert.ok(document.querySelector('[aria-label="Add Motorized blind"]'));
      assert.ok(document.querySelector('[aria-label="Add Wooden crib · 70 × 140"]'));
      await chooseRoom("Living room");
      assert.equal(document.querySelector("input").placeholder, "Search all items…");
      assert.equal(document.querySelector('[aria-label="Add Wooden crib · 70 × 140"]'), null);
      await act(async () => document.querySelector('[aria-label="Add Television"]').click());
      assert.equal(chosen[0].kind, "device");
      assert.equal(chosen[0].modelId, "television");
      assert.ok(
        document.querySelector('[aria-label="Add Television"]'),
        "model stays available for another copy",
      );
      await chooseRoom("Office");
      assert.ok(document.querySelector('[aria-label="Add Oak desk"]'));
      await act(async () => document.querySelector('[aria-label="Add Oak desk"]').click());
      assert.equal(chosen[1].modelId, "oak-desk");
      assert.equal(chosen[1].kind, "furnishing");
      for (const [roomName, appliances] of [
        [
          "Laundry",
          [
            ["Washing machine", "washing-machine"],
            ["Tumble dryer", "tumble-dryer"],
          ],
        ],
        [
          "Kitchen",
          [
            ["Dishwasher", "dishwasher"],
            ["Oven", "oven"],
            ["Microwave", "microwave"],
            ["Coffee maker", "coffee-maker"],
            ["Electric kettle", "electric-kettle"],
            ["Freezer", "freezer"],
            ["Pet feeder", "pet-feeder"],
          ],
        ],
      ]) {
        await chooseRoom(roomName);
        for (const [label, modelId] of appliances) {
          const card = document.querySelector(`[aria-label="Add ${label}"]`);
          assert.ok(card, label);
          await act(async () => card.click());
          assert.equal(chosen.at(-1).modelId, modelId);
          assert.equal(chosen.at(-1).kind, "device");
        }
      }
      await chooseRoom("All items");
      assert.ok(document.querySelector('[aria-label="Add Wooden crib · 70 × 140"]'));
      assert.ok(document.querySelector('[aria-label="Add Weather station"]'));
      await chooseRoom("Devices");
      assert.equal(document.querySelector("input").placeholder, "Search all items…");
      assert.equal(document.querySelector('[aria-label="Add Wooden crib · 70 × 140"]'), null);
      assert.ok(document.querySelector('[aria-label="Add Television"]'));
      assert.equal(
        document.querySelectorAll(".catalog-card").length,
        Object.values(ownerProjectRegistries.deviceModels).filter(
          (definition) => !definition.lightingOnly,
        ).length,
      );
      assert.ok(
        [...document.querySelectorAll(".catalog-card small")].every(
          (label) => label.textContent === "Device",
        ),
      );
      for (const selectedRoom of ["bedroom", "devices", "my-models"]) {
        await act(async () => browse({ room: selectedRoom, query: "weird relief wall art" }));
        const artwork = document.querySelector('[aria-label="Add Weird relief wall art"]');
        assert.ok(artwork, `search crosses the ${selectedRoom} category`);
        await act(async () => artwork.click());
        assert.equal(chosen.at(-1).modelId, "abstract-relief-wall-art");
        assert.ok(document.querySelector('[aria-label="All items catalog"]'));
      }
      await act(async () => browse({ room: "bedroom", query: "abstract relief wall art" }));
      assert.ok(document.querySelector('[aria-label="Add Weird relief wall art"]'));
      await act(async () => document.querySelector('[aria-label="Clear search"]').click());
      assert.equal(document.querySelector('[aria-label="Add Weird relief wall art"]'), null);
      assert.ok(document.querySelector('[aria-label="Add Wooden crib · 70 × 140"]'));
    });
  });

  test("fitting a blind from Properties updates size and placement as one undoable edit", async () => {
    await withDom(async ({ root, document, window }) => {
      const definition = ownerProjectRegistries.deviceModels["motorized-blind"];
      const wall = ownerHomeProject.floors[0].walls[0];
      const item = {
        id: "test-blind",
        kind: "device",
        modelId: "motorized-blind",
        entitySlots: [],
        size: definition.defaultSize,
        placement: {
          kind: "wall",
          wallId: wall.id,
          face: "right",
          offsetFromWallStartPlanUnits: 1,
          elevationMeters: 0.3,
          depthOffsetMeters: 0.003,
          rotationOffsetRadians: 0,
        },
      };
      let editor;
      function Harness() {
        editor = useFurnishingEditor([item]);
        return React.createElement(FurnishingInspector, {
          ...ownerProjectRegistries,
          items: editor.items,
          selectedId: item.id,
          floor: ownerHomeProject.floors[0],
          onPlacementChange: editor.updatePlacement,
          onSizeChange: editor.updateSize,
          onClose() {},
          onWindowFit: (id, placement, size, definition) => {
            editor.beginTransaction();
            editor.updatePlacement(id, placement);
            editor.updateSize(id, size, definition);
            editor.commitTransaction();
          },
        });
      }
      await act(async () => root.render(React.createElement(Harness)));
      const select = document.querySelector("select");
      assert.ok(select.options.length > 1);
      const optionLabels = [...select.options].map((option) => option.textContent);
      assert.ok(optionLabels.some((label) => label.includes("living-terrace-slider")));
      assert.ok(optionLabels.some((label) => label.includes("dining-terrace-slider")));
      await act(async () => {
        select.value = "0";
        select.dispatchEvent(new window.Event("change", { bubbles: true }));
      });
      assert.notDeepEqual(editor.items[0].size, item.size);
      assert.notDeepEqual(editor.items[0].placement, item.placement);
      assert.equal(editor.past.length, 1);
      assert.equal(
        document.querySelector("input[disabled]").closest("label").textContent,
        "Depth · m",
      );
      await act(async () => editor.undo());
      assert.deepEqual(editor.items[0], item);
    });
  });

  test("catalog clicks immediately add real items without a placement panel; shared history restores them", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    await withDom(async ({ root, document, window }) => {
      const record = createSeedProjectRecord(ownerHomeProject, 1);
      const saved = [];
      const lifecycle = {
        autosave: async (current, draft, _now, bindings) => {
          saved.push(draft);
          return {
            status: "saved",
            record: { ...current, draft, bindings, revision: current.revision + 1 },
          };
        },
      };
      const button = (label) => document.querySelector(`[aria-label="${label}"]`);
      const settle = () => act(async () => context.mock.timers.tick(5));
      function ArrangeHarness() {
        const controller = useHomeEditorController({
          initialRecord: record,
          lifecycle,
          autosaveDelayMs: 5,
          onClose() {},
          initialRequest: { mode: "furnish" },
        });
        // JSDOM has no WebGL camera. Supply the camera visibility handshake that
        // the real PreviewCamera sends before allowing a catalog placement.
        React.useEffect(() => {
          controller.handleCameraTargetChange([10, 4], () => true);
        }, [controller.handleCameraTargetChange]);
        return React.createElement(
          "main",
          null,
          React.createElement(HomeEditorHeader, controller),
          React.createElement(ArrangeCatalog, {
            enabled: true,
            furnishingModels: controller.furnishingModels,
            deviceModels: controller.deviceModels,
            browsing: { ...controller.catalogBrowsing, view: "items" },
            onBrowse: controller.setCatalogBrowsing,
            error: controller.catalogError,
            onChoose: controller.addCatalogItem,
          }),
          React.createElement(
            "p",
            { className: "arrange-announcement", role: "status" },
            controller.arrangeAnnouncement,
          ),
        );
      }
      await act(async () => root.render(React.createElement(ArrangeHarness)));
      await act(async () => button("Add Terracotta pendant").click());
      await settle();
      assert.equal(document.querySelector('[aria-label="Place item"]'), null);
      assert.match(
        document.querySelector(".arrange-announcement").textContent,
        /added.*Drag to move/,
        document.querySelector('[role="alert"]')?.textContent,
      );
      const added = saved.at(-1).sceneItems.at(-1);
      const originalItems = saved.at(-1).sceneItems.slice(0, -1);
      assert.equal(saved.at(-1).sceneItems.length, ownerHomeProject.sceneItems.length + 1);
      assert.equal(added.placement.kind, "ceiling");
      assert.equal(added.entitySlots[0].autoMap, "manual");
      await act(async () => button("Undo").click());
      await settle();
      assert.deepEqual(saved.at(-1).sceneItems, originalItems);
      await act(async () => button("Redo").click());
      await settle();
      assert.deepEqual(saved.at(-1).sceneItems.at(-1), added);
      await act(async () => button("Add Terracotta pendant").click());
      await settle();
      assert.equal(saved.at(-1).sceneItems.length, ownerHomeProject.sceneItems.length + 2);
      assert.notEqual(saved.at(-1).sceneItems.at(-1).entitySlots[0].id, added.entitySlots[0].id);
      await act(async () => button("Add Motorized blind").click());
      await settle();
      const blind = saved.at(-1).sceneItems.at(-1);
      assert.equal(blind.modelId, "motorized-blind");
      assert.equal(blind.placement.kind, "wall");
      assert.deepEqual(blind.entitySlots[0].compatibleDomains, ["cover"]);
      const opening = ownerHomeProject.floors[0].openings.find(
        (opening) =>
          opening.kind === "window" &&
          opening.wallId === blind.placement.wallId &&
          opening.offsetFromWallStartPlanUnits + opening.widthPlanUnits / 2 ===
            blind.placement.offsetFromWallStartPlanUnits,
      );
      assert.ok(opening);
      assert.ok(Math.abs((blind.size[1] * 1.48) / 1.6 - opening.openingHeightMeters) < 1e-10);
      await act(async () =>
        document.body.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "Backspace", bubbles: true }),
        ),
      );
      await settle();
      assert.equal(
        saved.at(-1).sceneItems.some((item) => item.id === blind.id),
        false,
      );
      await act(async () => button("Undo").click());
      await settle();
      assert.deepEqual(saved.at(-1).sceneItems.at(-1), blind);
      await act(async () => button("Undo").click());
      await settle();
      assert.equal(saved.at(-1).sceneItems.length, ownerHomeProject.sceneItems.length + 2);
    });
  });

  const { makeThreeFloorProject } = await load("/tests/fixtures/multiple-floors.ts");
  const { catalogEntries } = await load("/apps/web/src/editor-preview/furnish/catalog/catalog.ts");
  const { validateHomeProject } = await load("/packages/engine/src/index.ts");
  const { createCatalogItem } = await load(
    "/apps/web/src/editor-preview/furnish/placement/item-creation.ts",
  );
  test("catalog placement and duplication reserve identities across floors", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    await withDom(async ({ root }) => {
      const project = makeThreeFloorProject();
      const entries = catalogEntries(
        ownerProjectRegistries.furnishingModels,
        ownerProjectRegistries.deviceModels,
      );
      // Existing copies on another floor must reserve both item and slot IDs.
      for (const modelId of ["concealed-cistern-toilet", "counter-stool", "table-lamp"]) {
        const item = createCatalogItem(
          entries.find((entry) => entry.modelId === modelId),
          { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 },
          [],
          [],
          "second",
        );
        item.id = `${modelId}-copy`;
        if (item.kind === "device") item.entitySlots[0].id = `${modelId}-primary-copy`;
        project.sceneItems.push(item);
      }
      const record = createSeedProjectRecord(project, 1);
      const lifecycle = {
        autosave: async (current, draft, _now, bindings) => ({
          status: "saved",
          record: { ...current, draft, bindings, revision: current.revision + 1 },
        }),
      };
      let controller;
      function Harness() {
        controller = useHomeEditorController({
          initialRecord: record,
          lifecycle,
          autosaveDelayMs: 5,
          onClose() {},
          initialRequest: { mode: "furnish" },
        });
        return null;
      }
      const settle = () => act(async () => context.mock.timers.tick(5));
      await act(async () => root.render(React.createElement(Harness)));
      for (const floor of project.floors) {
        await act(async () => controller.floorNavigation.selectFloor(floor.id));
        await settle();
        controller.handleCameraTargetChange([2, 2], () => true);
        for (const modelId of ["concealed-cistern-toilet", "counter-stool", "table-lamp"]) {
          for (let repeat = 0; repeat < 2; repeat++) {
            await act(async () =>
              controller.addCatalogItem(entries.find((entry) => entry.modelId === modelId)),
            );
            await settle();
            assert.equal(controller.catalogError, null);
            if (repeat === 0) {
              const source = controller.furnishingEditor.items.at(-1);
              await act(async () => controller.duplicateArrangeItem(source.id));
              await settle();
            }
          }
        }
      }
      const draft = controller.snapshot.project;
      assert.equal(draft.sceneItems.length, 30);
      for (const original of project.sceneItems) {
        assert.deepEqual(
          draft.sceneItems.find((item) => item.id === original.id),
          original,
        );
      }
      const result = validateHomeProject(draft, ownerProjectRegistries);
      assert.deepEqual(result.issues, [], JSON.stringify(result.issues));
      assert.equal(new Set(draft.sceneItems.map((item) => item.id)).size, 30);
      // Room display names deliberately repeat across the fixture's floors.
      assert.equal(draft.floors[0].rooms[0].name, draft.floors[1].rooms[0].name);
    });
  });

  const { personalScaleFixture } = await load("/tests/fixtures/personal-models-scale.ts");
  test("custom model edits survive editor reconciliation and undo/redo across floors", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    await withDom(async ({ root }) => {
      const model = personalScaleFixture().project.customModels[0];
      const project = { ...makeThreeFloorProject(), customModels: [model] };
      project.sceneItems = project.floors.map((floor, i) => ({
        id: `personal-${i}`,
        floorId: floor.id,
        kind: "furnishing",
        modelId: model.id,
        size: model.normalization.size,
        placement: { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 },
      }));
      const { light: _light, ...base } = model;
      project.customModels = [{ ...base, profile: "furniture" }];
      const record = createSeedProjectRecord(project, 1);
      let controller;
      function Harness() {
        controller = useHomeEditorController({
          initialRecord: record,
          lifecycle: {
            autosave: async (current, draft, _now, bindings) => ({
              status: "saved",
              record: { ...current, draft, bindings, revision: current.revision + 1 },
            }),
          },
          autosaveDelayMs: 5,
          onClose() {},
          initialRequest: { mode: "furnish" },
        });
        return null;
      }
      await act(async () => root.render(React.createElement(Harness)));
      const before = structuredClone(controller.snapshot);
      const next = editCustomModel(controller.snapshot, model);
      await act(async () => {
        controller.replaceEditorsFromProject(next.project);
        controller.workspace.commit(next);
      });
      await act(async () => context.mock.timers.tick(5));
      assert.deepEqual(controller.snapshot, next);
      assert.deepEqual(
        controller.furnishingEditor.items,
        next.project.sceneItems.filter((item) => item.floorId === controller.activeFloorId),
      );
      await act(async () => controller.undoProject());
      assert.deepEqual(controller.snapshot, before);
      await act(async () => controller.redoProject());
      assert.deepEqual(controller.snapshot, next);
    });
  });

  test("history floor restoration preserves room identities and shared ceilings after settling", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    await withDom(async ({ root }) => {
      let editor;
      const floor = ownerProjectManifest.floors[0];
      function Harness() {
        editor = useConstructEditor(floor);
        return null;
      }
      await act(async () => root.render(React.createElement(Harness)));
      await act(async () => editor.replaceFloor(structuredClone(floor)));
      await act(async () => context.mock.timers.runAll());
      assert.deepEqual(editor.previewFloor, floor);
      assert.equal(
        new Set(editor.previewFloor.ceilings.map((ceiling) => ceiling.id)).size,
        floor.ceilings.length,
      );
      assert.deepEqual(
        editor.previewFloor.rooms.map((room) => [room.id, room.name]),
        floor.rooms.map((room) => [room.id, room.name]),
      );
    });
  });
});
