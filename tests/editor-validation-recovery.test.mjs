import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { useConstructEditor } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );
  const { useValidationLabels } = await load(
    "/apps/web/src/editor-preview/construct/useValidationLabels.ts",
  );
  const { collectConstructContextualIssues, visibleConstructIssues } = await load(
    "/apps/web/src/editor-preview/construct/contextual-validation.ts",
  );
  const { constructIssueKey } = await load(
    "/apps/web/src/editor-preview/construct/validation-visuals.ts",
  );
  const { useEditorCamera } = await load("/apps/web/src/editor-workspace/useEditorCamera.ts");
  const { useEditorIssueNavigation } = await load(
    "/apps/web/src/editor-workspace/useEditorIssueNavigation.ts",
  );
  const { ConstructionValidationMarker } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionValidationMarker.tsx",
  );
  const { EditorValidationPanel } = await load(
    "/apps/web/src/editor-workspace/EditorValidationPanel.tsx",
  );
  const { useFurnishingEditor } = await load(
    "/apps/web/src/editor-preview/furnish/useFurnishingEditor.ts",
  );
  const { placementForWorldDrag } = await load(
    "/apps/web/src/editor-preview/furnish/editor-state.ts",
  );
  const { useEditorIssueRepairs } = await load(
    "/apps/web/src/editor-workspace/useEditorIssueRepairs.ts",
  );
  const { interactionFloor: acceptedFloor } = await load("/tests/fixtures/interaction-floor.ts");
  const engine = await load("/packages/engine/src/index.ts");
  const { createEmptyHomeProject } = engine;
  const { deriveFloorTopology } = await load(
    "/packages/engine/src/home-editor/construct/topology.ts",
  );
  const { validateHomeProject } = await load("/packages/engine/src/home-project/validation.ts");
  const { projectFromEditorState } = await load("/apps/web/src/editor-preview/project-sync.ts");
  const ownerHomeProject = {
    ...createEmptyHomeProject("construction-fixture", "Construction fixture"),
    coordinates: acceptedFloor.coordinates,
    floors: [acceptedFloor],
  };
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
  const cabinet = {
    ...ownerProjectRegistries.deviceModels["wall-switch"],
    label: "Kitchen cabinet",
    defaultSize: [2.55, 2, 2.3],
    bounds: { min: [-1.275, -1, 0], max: [1.275, 1, 2.3] },
    resizePolicy: { kind: "uniform" },
    supportedDomains: ["sensor"],
  };
  const registries = {
    ...ownerProjectRegistries,
    deviceModels: {
      ...ownerProjectRegistries.deviceModels,
      "custom:11111111-2222-4333-8444-555555555555": cabinet,
    },
  };
  const brokenItem = () => ({
    id: "repair-target",
    floorId: acceptedFloor.id,
    kind: "device",
    modelId: "custom:11111111-2222-4333-8444-555555555555",
    size: cabinet.defaultSize,
    placement: {
      kind: "absolute",
      at: engine.polygonCentroid(acceptedFloor.rooms[0].polygon),
      elevationMeters: 0.2,
      rotationYRadians: 0.4,
    },
    entitySlots: [
      {
        id: "cabinet-primary",
        deviceRole: "primary",
        compatibleDomains: ["sensor"],
        required: true,
        autoMap: "manual",
        presentation: { label: "Cabinet", dashboardRole: "primary" },
      },
    ],
  });

  async function withDom(run) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const root = createRoot(dom.window.document.getElementById("root"));
    try {
      await run(root, dom.window.document);
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      Object.assign(globalThis, previous);
    }
  }

  test("Issues identifies named walls and openings on their floor and keeps Locate targets stable", async () => {
    await withDom(async (root, document) => {
      const floorId = "upper-floor";
      const issues = [
        { kind: "wall", id: acceptedFloor.walls[0].id },
        { kind: "opening", id: acceptedFloor.openings[0].id },
      ].map((target) => ({
        code: "opening.containment",
        path: target.kind,
        severity: "error",
        source: "project",
        message: "The opening does not fit in its wall.",
        suggestion: "Reduce its width.",
        floorId,
        target,
      }));
      const selected = [];
      function Harness({ prefix }) {
        const project = {
          ...ownerHomeProject,
          floors: [
            acceptedFloor,
            {
              ...acceptedFloor,
              id: floorId,
              walls: acceptedFloor.walls.map((wall) => ({
                ...wall,
                name: prefix && `${prefix} wall`,
              })),
              openings: acceptedFloor.openings.map((opening) => ({
                ...opening,
                name: prefix && `${prefix} door`,
              })),
            },
          ],
        };
        const repairs = useEditorIssueRepairs({ ...registries, editorProject: project });
        return React.createElement(EditorValidationPanel, {
          issues,
          expanded: true,
          itemLabel: repairs.itemLabel,
          onSelect: (issue) => selected.push(issue),
        });
      }
      for (const prefix of ["Kitchen", "Garden", undefined]) {
        await act(async () => root.render(React.createElement(Harness, { prefix })));
        const rows = [...document.querySelectorAll("li")];
        for (const [index, row] of rows.entries()) {
          const issue = issues[index];
          const name = prefix && `${prefix} ${index === 0 ? "wall" : "door"}`;
          if (name)
            assert.ok(row.querySelector(".editor-issues__message").textContent.includes(name));
          const button = row.querySelector("button");
          assert.ok(
            button
              .getAttribute("aria-label")
              .startsWith(`Locate ${issue.target.kind} ${name || issue.target.id}:`),
          );
          await act(async () => button.click());
        }
      }
      assert.deepEqual(selected, [...issues, ...issues, ...issues]);
    });
  });

  test("Arrange refuses unsupported moves and resizes without changing the draft or history", async () => {
    await withDom(async (root) => {
      const initial = brokenItem();
      const project = { ...ownerHomeProject, sceneItems: [initial] };
      let editor;
      function Harness() {
        editor = useFurnishingEditor([initial], { project, floor: acceptedFloor, registries });
        return null;
      }
      await act(async () => root.render(React.createElement(Harness)));
      assert.deepEqual(
        editor.items[0],
        initial,
        "opening the editor does not silently repair data",
      );
      await act(async () =>
        editor.updatePlacement(initial.id, { ...initial.placement, elevationMeters: 1 }),
      );
      const valid = editor.items[0];
      const historyLength = editor.past.length;
      await act(async () => editor.beginTransaction());
      await act(async () =>
        editor.updatePlacements({
          [valid.id]: { ...valid.placement, at: [2, 2], elevationMeters: 0.2 },
        }),
      );
      await act(async () => editor.commitTransaction());
      assert.deepEqual(editor.items[0], valid);
      assert.equal(editor.past.length, historyLength, "a rejected group move creates no undo step");
      assert.match(editor.placementError, /below the floor.*Change refused/);
      await act(async () =>
        editor.updateSize(
          valid.id,
          valid.size.map((value) => value * 2),
          cabinet,
        ),
      );
      assert.deepEqual(editor.items[0], valid, "resizing must check the scaled lower bounds");
      await act(async () =>
        editor.updatePlacement(valid.id, {
          kind: "ceiling",
          roomId: acceptedFloor.rooms[0].id,
          at: valid.placement.at,
          dropMeters: 0,
          rotationYRadians: 0,
        }),
      );
      assert.deepEqual(editor.items[0], valid, "the upper bounds cannot extend above a ceiling");
      const { position } = engine.resolveItemTransform(valid.placement, acceptedFloor);
      const moved = placementForWorldDrag({
        item: valid,
        definition: cabinet,
        floor: acceptedFloor,
        world: { x: position[0] + 0.1, z: position[2] },
        raw: true,
      });
      await act(async () => editor.updatePlacement(valid.id, moved));
      assert.deepEqual(
        editor.items[0].placement,
        moved,
        "wall-normalized models can move freely above the floor",
      );
      assert.equal(editor.placementError, null);
      await act(async () => editor.undo());
      assert.deepEqual(editor.items[0], valid);
      const fitted = {
        kind: "wall",
        wallId: acceptedFloor.walls[0].id,
        face: "right",
        offsetFromWallStartPlanUnits: 5,
        elevationMeters: 0.5,
        depthOffsetMeters: 0.003,
        rotationOffsetRadians: 0,
      };
      const half = valid.size.map((value) => value / 2);
      await act(async () => editor.updatePlacementAndSize(valid.id, fitted, half, cabinet));
      assert.deepEqual(
        editor.items[0].placement,
        fitted,
        "window fitting validates size and support together",
      );
      assert.deepEqual(editor.items[0].size, half);
      await act(async () => editor.undo());
      assert.deepEqual(editor.items[0], valid, "one undo restores both size and placement");
      await act(async () => {
        editor.updatePlacement(valid.id, { ...valid.placement, elevationMeters: 2 });
        editor.updateSize(
          valid.id,
          valid.size.map((value) => value * 2),
          cabinet,
        );
      });
      assert.equal(editor.items[0].placement.elevationMeters, 2);
      assert.deepEqual(
        editor.items[0].size,
        valid.size.map((value) => value * 2),
        "queued edits validate against the latest accepted state",
      );
      await act(async () => editor.replaceItems([initial]));
      await act(async () => editor.duplicate(initial.id, acceptedFloor));
      assert.equal(
        editor.items.length,
        1,
        "duplicating an invalid placement cannot create another bad item",
      );
      assert.equal(editor.past.length, 0);
    });
  });

  test("Issues selects, resets and removes a bad item with undoable private mapping cleanup", async () => {
    await withDom(async (root, document) => {
      const item = brokenItem();
      const project = { ...ownerHomeProject, sceneItems: [item] };
      const origin = "https://fixture.invalid";
      const profile = {
        schemaVersion: 1,
        homeId: project.home.id,
        roomAreaIds: {},
        entityIdsBySlotId: { "cabinet-primary": "sensor.fixture" },
      };
      const initial = {
        project,
        bindings: {
          [origin]: {
            draft: profile,
            published: structuredClone(profile),
            manualRoomIds: [],
            manualSlotIds: ["cabinet-primary"],
          },
        },
      };
      let history, setHistory;
      const selected = [],
        restored = [];
      function Harness({ disabled = false }) {
        [history, setHistory] = React.useState(() => engine.createWorkspaceHistory(initial));
        const snapshot = history.present;
        const repairs = useEditorIssueRepairs({
          ...registries,
          snapshot,
          editorProject: snapshot.project,
          commit: (next) => setHistory((current) => engine.commitWorkspaceSnapshot(current, next)),
          replaceEditorsFromProject: (next) => restored.push(next),
        });
        const validation = validateHomeProject(snapshot.project, registries);
        assert.equal(validation.valid, true, JSON.stringify(validation.issues));
        const issues = collectConstructContextualIssues({
          project: snapshot.project,
          floor: acceptedFloor,
          sceneItems: snapshot.project.sceneItems,
          projectIssues: validation.issues,
        });
        return React.createElement(EditorValidationPanel, {
          issues,
          onSelect: (issue) => selected.push(issue.target.id),
          onRepair: repairs.repairIssue,
          itemLabel: repairs.itemLabel,
          expanded: true,
          disabled,
        });
      }
      await act(async () => root.render(React.createElement(Harness)));
      assert.match(document.body.textContent, /Kitchen cabinet/);
      assert.match(document.body.textContent, /Select/);
      assert.equal(
        document.querySelector("button button"),
        null,
        "repair buttons must not nest inside Locate",
      );
      await act(async () => document.querySelector('[aria-label^="Select"]').click());
      assert.deepEqual(selected, [item.id]);
      const action = (label) =>
        [...document.querySelectorAll("footer button")].find(
          (button) => button.textContent.trim() === label,
        );
      await act(async () => action("Reset placement").click());
      assert.equal(document.querySelector('[aria-label="Editor validation"]'), null);
      assert.equal(history.past.length, 1);
      assert.deepEqual(history.present.project.sceneItems[0].size, item.size);
      assert.deepEqual(
        history.present.bindings[origin].draft.entityIdsBySlotId,
        profile.entityIdsBySlotId,
      );
      await act(async () => setHistory((current) => engine.undoWorkspaceHistory(current)));
      assert.deepEqual(history.present, initial);
      await act(async () => root.render(React.createElement(Harness, { disabled: true })));
      assert.equal(action("Reset placement").disabled, true);
      assert.equal(action("Remove item").disabled, true);
      await act(async () => root.render(React.createElement(Harness)));
      await act(async () => action("Remove item").click());
      assert.equal(history.past.length, 1);
      assert.deepEqual(history.present.project.sceneItems, []);
      assert.deepEqual(history.present.bindings[origin].draft.entityIdsBySlotId, {});
      assert.deepEqual(history.present.bindings[origin].published, profile);
      await act(async () => setHistory((current) => engine.undoWorkspaceHistory(current)));
      assert.deepEqual(history.present, initial);
      await act(async () => setHistory((current) => engine.redoWorkspaceHistory(current)));
      assert.deepEqual(history.present.project.sceneItems, []);
      assert.equal(restored.length, 2);
    });
  });

  test("hover and keyboard focus expose every full error and correction outside the canvas", async () => {
    await withDom(async (root, document) => {
      const issues = [
        {
          message: "A wall attachment is too high to fit between the floor and the wall top.",
          suggestion: "Lower the attachment or reduce its height.",
        },
        {
          message: "The attachment extends past the end of its supporting wall.",
          suggestion: "Move it inward.",
        },
      ];
      let activated = 0;
      let hidden = 0;
      await act(async () =>
        root.render(
          React.createElement(ConstructionValidationMarker, {
            issues,
            number: 12,
            active: false,
            onActivate() {
              activated++;
            },
            onDismiss() {
              hidden++;
            },
          }),
        ),
      );
      const button = document.querySelector(".construction-validation-marker__details");
      assert.equal(button.textContent, "12");
      assert.ok(button.querySelector("svg"));
      await act(async () =>
        button.dispatchEvent(new window.MouseEvent("mouseover", { bubbles: true })),
      );
      const tooltip = document.querySelector('[role="tooltip"]');
      assert.equal(tooltip.parentElement, document.body);
      for (const issue of issues) {
        assert.ok(tooltip.textContent.includes(issue.message));
        assert.ok(tooltip.textContent.includes(issue.suggestion));
      }
      assert.equal(button.getAttribute("aria-describedby"), tooltip.id);
      await act(async () =>
        document.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
      );
      assert.equal(document.querySelector('[role="tooltip"]'), null);
      await act(async () => button.focus());
      assert.ok(document.querySelector('[role="tooltip"]'));
      await act(async () => button.click());
      assert.equal(activated, 1);
      await act(async () =>
        document.querySelector(".construction-validation-marker__dismiss").click(),
      );
      assert.equal(hidden, 1);
    });
  });

  test("project diagnostics resolve global item indices and nested attachments on their actual floors", () => {
    const upper = {
      ...acceptedFloor,
      id: "upper",
      walls: [{ ...acceptedFloor.walls[0], niches: [{ id: "high-niche" }] }],
    };
    const items = [
      { id: "ground-item", floorId: acceptedFloor.id },
      { id: "upper-item", floorId: "upper" },
    ];
    const result = collectConstructContextualIssues({
      floor: acceptedFloor,
      sceneItems: [items[0]],
      project: { floors: [acceptedFloor, upper], sceneItems: items },
      projectIssues: [
        {
          code: "project.wall-support-height",
          path: "sceneItems[1].placement.elevationMeters",
          severity: "error",
          message: "Wall attachment must fit below the wall top.",
        },
        {
          code: "niche.height",
          path: "floors[1].walls[0].niches[0]",
          severity: "error",
          message: "Niche must fit below the wall top.",
        },
      ],
    });
    assert.deepEqual(
      result.map((issue) => [issue.floorId, issue.target]),
      [
        ["upper", { kind: "niche", id: "high-niche" }],
        ["upper", { kind: "scene-item", id: "upper-item" }],
      ],
    );
  });

  test("Locate selects and frames the affected object rather than a related wall or error point", async () => {
    await withDom(async (root) => {
      const calls = [];
      let camera;
      const area = {
        polygon: [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
        ],
      };
      const floor = {
        ...acceptedFloor,
        rooms: [{ ...area, id: "room" }],
        ceilings: [{ id: "ceiling", roomIds: ["room"] }],
        groundZones: [{ ...area, id: "zone" }],
        pools: [{ ...area, id: "pool" }],
        outdoorPlatforms: [{ ...area, id: "platform" }],
        walls: [
          {
            ...acceptedFloor.walls[0],
            from: [0, 0],
            to: [10, 0],
            niches: [{ id: "niche", offsetFromWallStartPlanUnits: 1, widthPlanUnits: 2 }],
          },
        ],
        openings: [
          {
            id: "opening",
            wallId: acceptedFloor.walls[0].id,
            offsetFromWallStartPlanUnits: 6,
            widthPlanUnits: 2,
          },
        ],
      };
      const items = [
        {
          id: "lamp",
          placement: { kind: "wall", wallId: floor.walls[0].id, offsetFromWallStartPlanUnits: 2 },
        },
      ];
      function Harness() {
        camera = useEditorCamera({
          constructEditor: {
            previewFloor: floor,
            wallRuns: [],
            setTool: (tool) => calls.push(tool),
            selectOpening: (id) => calls.push(id),
            selectWall: (id) => calls.push(id),
            selectRoom: (id) => calls.push(id),
            selectPool: (id) => calls.push(id),
            selectPlatform: (id) => calls.push(id),
            selectFloorZone: (id) => calls.push(id),
          },
          furnishingEditor: { select: (id) => calls.push(id) },
          previewSceneItems: items,
        });
        return null;
      }
      await act(async () => root.render(React.createElement(Harness)));
      for (const [kind, id, point, mode] of [
        ["scene-item", "lamp", [2, 0], "furnish"],
        ["niche", "niche", [2, 0], "construct"],
        ["opening", "opening", [7, 0], "construct"],
        ["floor-zone", "zone", [2, 2], "construct"],
        ["outdoor-platform", "platform", [2, 2], "construct"],
        ["pool", "pool", [2, 2], "construct"],
        ["room", "room", [2, 2], "construct"],
        ["ceiling", "ceiling", [2, 2], "construct"],
      ]) {
        calls.length = 0;
        await act(async () =>
          camera.focusIssue(
            {
              code: "height",
              path: id,
              message: `Issue on wall “${floor.walls[0].id}”.`,
              target: { kind, id },
            },
            (mode) => calls.push(mode),
          ),
        );
        assert.equal(calls[0], mode);
        assert.equal(calls.at(-1), kind === "ceiling" ? "room" : id);
        assert.deepEqual(camera.cameraFocusPoint, point);
      }
    });
  });

  test("Locate waits for the requested floor to restore before selecting the attachment", async () => {
    await withDom(async (root) => {
      let locate;
      const requestedFloors = [],
        focused = [];
      const issue = { floorId: "upper", target: { kind: "scene-item", id: "upper-lamp" } };
      const selectFloor = (id) => requestedFloors.push(id);
      const focusCameraIssue = (value) => focused.push(value);
      const selectMode = () => {};
      function Harness({ activeFloorId, previewFloorId }) {
        locate = useEditorIssueNavigation({
          activeFloorId,
          previewFloorId,
          selectFloor,
          focusCameraIssue,
          selectMode,
        });
        return null;
      }
      await act(async () =>
        root.render(
          React.createElement(Harness, { activeFloorId: "ground", previewFloorId: "ground" }),
        ),
      );
      await act(async () => locate(issue));
      assert.deepEqual(requestedFloors, ["upper"]);
      assert.deepEqual(focused, []);
      await act(async () =>
        root.render(
          React.createElement(Harness, { activeFloorId: "upper", previewFloorId: "ground" }),
        ),
      );
      assert.deepEqual(focused, []);
      await act(async () =>
        root.render(
          React.createElement(Harness, { activeFloorId: "upper", previewFloorId: "upper" }),
        ),
      );
      assert.deepEqual(focused, [issue]);
    });
  });

  test("separator walls survive draft recovery without errors and can later close a room", async () => {
    await withDom(async (root, document) => {
      let editor;
      let allIssues;
      const focused = [];
      function Harness({ floor = acceptedFloor }) {
        editor = useConstructEditor(floor, acceptedFloor);
        const project = projectFromEditorState(
          ownerHomeProject,
          editor.previewFloor,
          ownerHomeProject.sceneItems,
        );
        allIssues = collectConstructContextualIssues({
          floor: editor.previewFloor,
          topologyIssues: editor.topologyIssues,
          projectIssues: validateHomeProject(project, ownerProjectRegistries).issues,
        });
        return React.createElement(EditorValidationPanel, {
          issues: visibleConstructIssues(allIssues, editor.tool),
          onSelect: (issue) => focused.push(issue),
        });
      }
      await act(async () => root.render(React.createElement(Harness)));
      assert.equal(editor.topologyIssues.length, 0);
      const corners = [
        [0, -5],
        [3, -5],
        [3, -2],
        [0, -2],
      ];
      await act(async () => editor.setTool("wall"));
      await act(async () => editor.beginWall(corners[0]));
      for (const corner of corners.slice(1)) await act(async () => editor.addWall(corner));
      assert.equal(
        document.querySelector('[aria-label="Editor validation"]'),
        null,
        "do not interrupt wall drawing with closure issues",
      );
      assert.equal(allIssues.length, 0, "separator walls do not block Apply");
      await act(async () => editor.cancelWall());
      assert.equal(editor.tool, "wall");
      assert.equal(
        document.querySelector('[aria-label="Editor validation"]'),
        null,
        "ending a chain does not leave Wall mode",
      );
      await act(async () => editor.setTool("select"));
      assert.equal(editor.topologyIssues.length, 0);
      assert.equal(
        document.querySelectorAll(".construction-inspector__validation li button").length,
        0,
      );
      const recovered = structuredClone(editor.previewFloor);
      await act(async () =>
        root.render(React.createElement(Harness, { key: "recovered", floor: recovered })),
      );
      assert.equal(
        editor.topologyIssues.filter((issue) => issue.code === "topology.open-walls").length,
        0,
      );
      assert.equal(
        document.querySelectorAll(".construction-inspector__validation li button").length,
        0,
        "recovered separators remain valid in Select",
      );
      await act(async () => editor.setTool("wall"));
      assert.equal(
        document.querySelector('[aria-label="Editor validation"]'),
        null,
        "resuming Wall defers the existing completion issues again",
      );
      await act(async () => editor.beginWall(corners[3]));
      await act(async () => editor.addWall(corners[0]));
      assert.equal(
        editor.topologyIssues.filter((issue) => issue.code === "topology.open-walls").length,
        0,
        JSON.stringify({
          issues: editor.topologyIssues,
          walls: editor.draft.walls.filter((w) => w.from[1] < 0 || w.to[1] < 0),
        }),
      );
      const shack = editor.previewFloor.rooms.find((room) =>
        room.polygon.every((point) => point[1] < 0),
      );
      assert.ok(shack);
      assert.equal(editor.drawStart, null);
      assert.equal(editor.tool, "select", "closing a room returns to Select");
      assert.match(shack.name, /^Unnamed room \d+$/);
      assert.equal(allIssues.length, 0, "new rooms receive valid default names");
      await act(async () => editor.updateRoom(shack.id, { name: "" }));
      assert.equal(
        allIssues.length,
        1,
        "real topology and project validators produce one naming issue for an explicitly blank name",
      );
      assert.equal(allIssues[0].code, "room.name");
      assert.ok(
        document.querySelector('[aria-label="Editor validation"]'),
        "the naming prompt appears after automatic return to Select",
      );
      const namingButtons = document.querySelectorAll(
        ".construction-inspector__validation li button",
      );
      assert.equal(namingButtons.length, 1);
      const namingIssue = namingButtons[0].closest("li");
      assert.match(namingIssue.textContent, /This room needs a name/);
      assert.doesNotMatch(namingIssue.textContent, /Expected a non-empty string/);
      await act(async () => editor.selectRoom(shack.id));
      await act(async () => editor.updateSelectedRoom({ name: "Wooden shack" }));
      assert.equal(editor.topologyIssues.length, 0, JSON.stringify(editor.topologyIssues));
      assert.equal(allIssues.length, 0, "naming the room clears every validator's issue");
      assert.equal(editor.previewFloor.footprintRegions.length, 2);
      await act(async () => editor.replaceFloor(recovered));
      assert.equal(
        editor.topologyIssues.filter((issue) => issue.code === "topology.open-walls").length,
        0,
        "restoring separator walls does not create diagnostics",
      );
    });
  });

  test("Locate restores a hidden label repeatedly, and resolved errors are not permanently hidden", async () => {
    await withDom(async (root) => {
      const issue = {
        code: "topology.wall-overlap",
        path: 'walls["shack"]',
        message: "Walls overlap.",
        source: "topology",
        severity: "fatal",
        suggestion: "Remove the overlap.",
        target: { kind: "wall", id: "shack" },
      };
      const key = constructIssueKey(issue);
      let labels;
      function Harness({ issues = [issue], focusVersion = 0 }) {
        labels = useValidationLabels(issues, key, focusVersion);
        return null;
      }
      await act(async () => root.render(React.createElement(Harness)));
      for (const focusVersion of [1, 2]) {
        await act(async () => labels.hide([key]));
        assert.equal(labels.hiddenKeys.has(key), true);
        await act(async () => root.render(React.createElement(Harness, { focusVersion })));
        assert.equal(labels.hiddenKeys.has(key), false);
      }
      await act(async () => labels.hide([key]));
      await act(async () =>
        root.render(React.createElement(Harness, { issues: [], focusVersion: 2 })),
      );
      await act(async () => root.render(React.createElement(Harness, { focusVersion: 2 })));
      assert.equal(labels.hiddenKeys.has(key), false);
    });
  });

  test("an open extension on a split source wall remains valid and retains its geometry", () => {
    const result = deriveFloorTopology({
      floorId: "floor",
      floorName: "Floor",
      rooms: [],
      openings: [],
      walls: [
        { id: "top", from: [0, 0], to: [4, 0] },
        { id: "right", from: [4, 0], to: [4, 3] },
        { id: "bottom", from: [4, 3], to: [0, 3] },
        { id: "left", from: [0, 3], to: [0, 0] },
        { id: "divider", from: [2, 0], to: [2, 5] },
      ],
    });
    const open = result.issues.filter((issue) => issue.code === "topology.open-walls");
    assert.equal(open.length, 0);
    assert.equal(result.floor.rooms.length, 2);
    const extension = result.floor.walls.find((wall) => wall.id === "divider--split-2");
    assert.ok(extension, "retain the separator beyond the closed rooms");
  });
});
