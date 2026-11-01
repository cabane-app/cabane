import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { create } from "@react-three/test-renderer";
import { OrthographicCamera, Ray, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { snapPlanPoint } = await load(
    "/packages/engine/src/home-editor/construct/editor-state.ts",
  );
  const { worldDragToSnappedConstructPlan } = await load(
    "/apps/web/src/editor-preview/construct/drag-geometry.ts",
  );
  const { constructPixelsPerMeter, wallSnapRadiusPixels } = await load(
    "/apps/web/src/editor-preview/construct/plan-screen-scale.ts",
  );
  const { ConstructionEditLayer } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionEditLayer.tsx",
  );
  const { ConstructionWallGuide } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionWallGuide.tsx",
  );
  const { ConstructionDistanceLabel } = await load(
    "/apps/web/src/editor-preview/construct/ConstructionDistanceLabel.tsx",
  );
  const { useConstructEditor } = await load(
    "/apps/web/src/editor-preview/construct/useConstructEditor.ts",
  );
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const coordinates = { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" };
  const floor = neutralDemoManifest.floors[0];
  const cameraAt = (zoom) => {
    const camera = new OrthographicCamera(-500, 500, 400, -400, 0.1, 100);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    return camera;
  };
  const pointer = (x, z, altKey = false, pointerType = "mouse") => ({
    pointerId: 1,
    button: 0,
    target: {
      setPointerCapture() {},
      hasPointerCapture() {
        return true;
      },
      releasePointerCapture() {},
    },
    stopPropagation() {},
    nativeEvent: { altKey, pointerType, clientX: x * 100, clientY: z * 100 },
    ray: new Ray(new Vector3(x, 10, z), new Vector3(0, -1, 0)),
  });
  const layerProps = (walls = []) => ({
    draft: {
      version: 1,
      floorId: "test",
      floorName: "Test",
      coordinates,
      walls,
      openings: [],
      rooms: [],
      junctions: [],
      defaultWallHeightMeters: 2.5,
      defaultCeilingHeightMeters: 2.5,
      exteriorWallThicknessMeters: 0.2,
      interiorWallThicknessMeters: 0.12,
      tool: "wall",
      selection: null,
      view: { center: [0, 0], pixelsPerMeter: 82 },
      nextSerial: 1,
    },
    planMode: true,
    coordinates,
    rooms: [],
    tool: "wall",
    selection: null,
    onSelectWall() {},
    onSelectOpening() {},
    onSelectRoom() {},
    onMoveEndpoint() {},
    onTranslateWall() {},
    onMoveOpening() {},
    onResizeOpening() {},
    onPlaceOpening() {},
    onBeginWall() {},
    onPreviewWall() {},
    onAddWall() {},
    onCancelWall() {},
  });

  test("pool and floor share wall angle guides, relative snapping, Alt and pointer commits", async () => {
    for (const tool of ["pool", "floor"]) {
      const seen = [];
      const points = [
        [20, 0],
        [21, 0.2],
      ];
      const props = {
        ...layerProps(),
        tool,
        drawStart: points[1],
        drawPreview: [20.8, 1.2],
        poolPoints: tool === "pool" ? points : [],
        floorPaintTarget: "custom-area",
        floorZonePoints: tool === "floor" ? points : [],
        floorZonePreview: [20.8, 1.2],
        onPreviewWall: (p) => seen.push(p),
        onAddWall: (p) => seen.push(p),
        onPreviewFloorZonePoint: (p) => seen.push(p),
        onPlaceFloorZonePoint: (p) => seen.push(p),
      };
      const renderer = await create(createElement(ConstructionEditLayer, props), {
        camera: cameraAt(100),
        width: 1000,
        height: 800,
      });
      try {
        assert.ok(renderer.scene.findAllByProps({ name: "construction-wall-guide" }).length);
        const angles = renderer.scene.findAllByProps({ name: "construction-angle-guide" });
        assert.ok(angles.some((angle) => Math.abs(angle.props.userData.degrees - 90) < 0.01));
        const surface = renderer.scene.findByProps({ name: "construction-placement-surface" });
        await renderer.fireEvent(surface, "pointerMove", pointer(20.85, 1.21));
        await renderer.fireEvent(surface, "pointerUp", pointer(20.85, 1.21));
        assert.deepEqual(seen, [
          [20.8, 1.2],
          [20.8, 1.2],
        ]);
        await renderer.fireEvent(surface, "pointerMove", pointer(20.85, 1.21, true));
        assert.deepEqual(seen.at(-1), [20.85, 1.21]);
      } finally {
        await renderer.unmount();
      }
    }
  });

  test("snaps near all eight 45-degree directions from scaled off-grid starts", () => {
    const start = [10.123456, -2.654321];
    for (const metersPerPlanUnit of [0.5, 1, 2]) {
      for (let direction = 0; direction < 8; direction++) {
        const angle = (direction * Math.PI) / 4;
        const candidate = [
          start[0] + Math.cos(angle + 0.05) * 2.84,
          start[1] + Math.sin(angle + 0.05) * 2.84,
        ];
        const result = snapPlanPoint({
          candidate,
          walls: [],
          pixelsPerMeter: 100,
          angleOrigin: start,
          coordinates: { ...coordinates, origin: [10, -2], metersPerPlanUnit },
        });
        const delta = result.point.map((value, axis) => value - start[axis]);
        assert.equal(result.kind, "angle-grid");
        assert.ok(Math.abs(delta[0] * Math.sin(angle) - delta[1] * Math.cos(angle)) < 1e-10);
        assert.ok(delta[0] * Math.cos(angle) + delta[1] * Math.sin(angle) > 0);
        const steps = (Math.max(...delta.map(Math.abs)) * metersPerPlanUnit) / 0.1;
        assert.ok(Math.abs(steps - Math.round(steps)) < 1e-10);
      }
    }
  });

  test("only catches angles within five degrees, on both sides of every direction", () => {
    const start = [10.123456, -2.654321];
    for (const metersPerPlanUnit of [0.5, 1, 2]) {
      for (let direction = 0; direction < 8; direction++) {
        for (const offsetDegrees of [-5.01, -5, -4.99, 4.99, 5, 5.01, 15, 22.5]) {
          const angle = ((direction * 45 + offsetDegrees) * Math.PI) / 180;
          const candidate = [start[0] + Math.cos(angle) * 3, start[1] + Math.sin(angle) * 3];
          const input = {
            candidate,
            walls: [],
            pixelsPerMeter: 100,
            coordinates: { ...coordinates, origin: [10, -2], metersPerPlanUnit },
          };
          const result = snapPlanPoint({ ...input, angleOrigin: start });
          const close = Math.abs(offsetDegrees) <= 5;
          assert.equal(
            result.kind,
            close ? "angle-grid" : "grid",
            `${direction * 45}° + ${offsetDegrees}°`,
          );
          if (!close)
            assert.deepEqual(
              result,
              snapPlanPoint(input),
              "outside the catch zone only the normal grid applies",
            );
        }
      }
    }
    assert.deepEqual(
      snapPlanPoint({ candidate: [2, 0.55], walls: [], pixelsPerMeter: 100, angleOrigin: [0, 0] }),
      {
        kind: "grid",
        point: [2, 0.6],
      },
    );
    assert.deepEqual(
      snapPlanPoint({ candidate: [2, 1], walls: [], pixelsPerMeter: 100, angleOrigin: [0, 0] }),
      {
        kind: "grid",
        point: [2, 1],
      },
    );
  });

  test("rotates every 45-degree snap direction with the preceding wall", () => {
    const start = [21, 0.2];
    const previousAngle = Math.atan2(0.2, 1);
    const candidate = [20.85, 1.21];
    const result = snapPlanPoint({
      candidate,
      walls: [],
      pixelsPerMeter: 100,
      angleOrigin: start,
      angleReferenceRadians: previousAngle,
    });
    assert.equal(result.kind, "angle-grid");
    assert.deepEqual(result.point, [20.8, 1.2]);
  });

  test("wall preview and commit remain free-angle away from snap directions without Alt", async () => {
    const seen = [];
    const props = {
      ...layerProps(),
      drawStart: [0, 0],
      drawPreview: [0, 0],
      onPreviewWall: (point) => seen.push(point),
      onAddWall: (point) => seen.push(point),
    };
    const renderer = await create(createElement(ConstructionEditLayer, props), {
      camera: cameraAt(100),
      width: 1000,
      height: 800,
    });
    try {
      const surface = renderer.scene.findByProps({ name: "construction-placement-surface" });
      for (const [x, z, expected] of [
        [2, 1, [2, 1]],
        [2, 1.93, [2, 2]],
      ]) {
        await renderer.fireEvent(surface, "pointerMove", pointer(x, z));
        await renderer.fireEvent(surface, "pointerUp", pointer(x, z));
        assert.deepEqual(seen.splice(0), [expected, expected]);
      }
      await renderer.fireEvent(surface, "pointerMove", pointer(2, 1.93, true));
      await renderer.fireEvent(surface, "pointerUp", pointer(2, 1.93, true));
      assert.deepEqual(
        seen,
        [
          [2, 1.93],
          [2, 1.93],
        ],
        "Alt still bypasses the nearby angle assist",
      );
    } finally {
      await renderer.unmount();
    }
  });

  test("wall preview uses the remembered exterior color", async () => {
    const renderer = await create(
      createElement(ConstructionEditLayer, {
        ...layerProps(),
        drawStart: [0, 0],
        drawPreview: [2, 0],
        wallExteriorColor: "#b86f58",
      }),
      { camera: cameraAt(100), width: 1000, height: 800 },
    );
    try {
      const preview = renderer.scene.findByProps({ name: "construction-wall-preview" });
      assert.equal(preview.instance.material.emissive.getHexString(), "b86f58");
    } finally {
      await renderer.unmount();
    }
  });

  test("wall radii respect CSS pixels, live zoom, pointer type, and floor scale", () => {
    const transformed = { ...coordinates, origin: [10, -2], metersPerPlanUnit: 0.5 };
    const walls = [{ id: "wall", from: [10, -2], to: [20, -2] }];
    for (const [pointerType, radius] of [
      ["mouse", 24],
      ["pen", 28],
      ["touch", 36],
    ]) {
      assert.equal(wallSnapRadiusPixels(pointerType), radius);
      for (const zoom of [25, 100, 250]) {
        const camera = cameraAt(zoom);
        const ppm = constructPixelsPerMeter(camera, 800);
        assert.equal(ppm, zoom);
        for (const [difference, expected] of [
          [-0.01, "endpoint"],
          [0.01, "grid"],
        ]) {
          const distance = (radius + difference) / ppm / transformed.metersPerPlanUnit;
          const result = snapPlanPoint({
            candidate: [10 - distance, -2],
            walls,
            coordinates: transformed,
            pixelsPerMeter: ppm,
            pointerType,
            snapRadiusPixels: radius,
          });
          assert.equal(result.kind, expected);
        }
        const nearSurface = snapPlanPoint({
          candidate: [15, -2 + (radius - 0.01) / ppm / 0.5],
          walls,
          coordinates: transformed,
          pixelsPerMeter: ppm,
          pointerType,
          snapRadiusPixels: radius,
        });
        assert.equal(nearSurface.kind, "wall");
      }
    }
  });

  test("keeps endpoint priority and leaves other tools' default radii unchanged", () => {
    const walls = [
      { id: "one", from: [0, 0], to: [4, 0] },
      { id: "closer", from: [-2, 0.1], to: [2, 0.1] },
    ];
    const endpoint = snapPlanPoint({
      candidate: [0.2, 0.1],
      walls,
      pixelsPerMeter: 100,
      snapRadiusPixels: 24,
      angleOrigin: [-1, -1],
    });
    assert.equal(endpoint.kind, "endpoint");
    assert.deepEqual(endpoint.point, [0, 0]);
    const input = { candidate: [-0.23, 0], walls: walls.slice(0, 1), pixelsPerMeter: 100 };
    assert.equal(snapPlanPoint(input).kind, "grid");
    assert.equal(snapPlanPoint({ ...input, snapRadiusPixels: 24 }).kind, "endpoint");
  });

  test("Alt bypasses endpoint, surface, angle, and grid snapping through the adapter", () => {
    for (const point of [
      { x: -0.19, z: 0.03 },
      { x: 2.013, z: 0.15 },
      { x: 3.123, z: 1.987 },
    ]) {
      assert.deepEqual(
        worldDragToSnappedConstructPlan({
          point,
          coordinates,
          walls: [{ id: "wall", from: [0, 0], to: [4, 0] }],
          pixelsPerMeter: 50,
          angleOrigin: [0, 0],
          snapRadiusPixels: 24,
          absolute: true,
        }),
        [point.x, point.z],
      );
    }
  });

  test("corner snapping ignores reshaped geometry but retains fixed endpoints and other walls", () => {
    const movingEndpoint = [2, 1.85];
    const walls = [
      { id: "active", from: [0, 0], to: movingEndpoint },
      { id: "connected", from: movingEndpoint, to: [2, 4] },
      { id: "target", from: [4, 2], to: [6, 2] },
    ];
    const input = { walls, pixelsPerMeter: 100, snapRadiusPixels: 24, angleOrigin: [0, 0] };
    assert.deepEqual(snapPlanPoint({ ...input, candidate: [2, 1.93] }).point, movingEndpoint);
    for (const [candidate, kind, expected] of [
      [[2, 1.93], "alignment", [2, 2]],
      [[1, 0.96], "angle-grid", [1, 1]],
      [[2.06, 3.2], "angle-grid", [2, 3.2]],
      [[2.04, 3.96], "endpoint", [2, 4]],
      [[4.13, 2.03], "endpoint", [4, 2]],
      [[5, 2.15], "wall", [5, 2]],
    ]) {
      const result = snapPlanPoint({ ...input, movingEndpoint, candidate });
      assert.equal(result.kind, kind);
      assert.deepEqual(result.point, expected);
    }
  });

  test("either wall corner gets nearby-angle assistance from its fixed opposite endpoint", async () => {
    for (const endpointName of ["from", "to"]) {
      const anchor = [0.03, 0.07];
      const corner = [2.03, 1.92];
      const walls = [
        { id: "active", from: anchor, to: anchor, [endpointName]: corner },
        { id: "connected", from: corner, to: [2.03, 4.07] },
      ];
      const moves = [];
      const props = {
        ...layerProps(walls),
        tool: "select",
        selection: { kind: "wall", id: "active" },
        onMoveEndpoint: (...args) => moves.push(args),
      };
      const renderer = await create(createElement(ConstructionEditLayer, props), {
        camera: cameraAt(100),
        width: 1000,
        height: 800,
      });
      const endpoint = () =>
        renderer.scene.findByProps({ name: `construction-wall-endpoint-active-${endpointName}` });
      const guide = () =>
        renderer.scene.findByProps({ name: "construction-wall-guide" }).props.userData;
      try {
        await renderer.fireEvent(endpoint(), "pointerDown", pointer(...corner));
        for (const [candidate, altKey, expected] of [
          [[2.03, 2], false, [2.03, 2.07]],
          [[3.03, 1.07], false, [3, 1.1]],
          [[2.03, 2], true, [2.03, 2]],
          [[0.09, 3.07], false, [0.03, 3.07]],
        ]) {
          await renderer.fireEvent(endpoint(), "pointerMove", pointer(...candidate, altKey));
          assert.deepEqual(guide()[endpointName], expected);
          assert.deepEqual(guide()[endpointName === "from" ? "to" : "from"], anchor);
          const connected = renderer.scene.findByProps({
            name: "construction-wall-target-connected",
          });
          assert.deepEqual(connected.props.position, [
            (expected[0] + 2.03) / 2,
            0.1,
            (expected[1] + 4.07) / 2,
          ]);
          assert.equal(moves.length, 0, "previewing a shared corner must not commit an edit");
        }
        await renderer.fireEvent(endpoint(), "pointerUp", pointer(0.09, 3.07));
        assert.deepEqual(moves, [["active", endpointName, [0.03, 3.07]]]);
        assert.equal(renderer.scene.findAllByProps({ name: "construction-wall-guide" }).length, 0);
      } finally {
        await renderer.unmount();
      }
    }
  });

  test("drawing uses the current camera zoom for preview and commit without rebuilding the layer", async () => {
    const seen = [];
    const camera = cameraAt(100);
    const props = {
      ...layerProps([{ id: "wall", from: [0, 0], to: [4, 0] }]),
      drawStart: [-3, -3],
      drawPreview: [-3, -3],
      onPreviewWall: (point) => seen.push(point),
      onAddWall: (point) => seen.push(point),
    };
    const renderer = await create(createElement(ConstructionEditLayer, props), {
      camera,
      width: 1000,
      height: 800,
    });
    try {
      const surface = renderer.scene.findByProps({ name: "construction-placement-surface" });
      await renderer.fireEvent(surface, "pointerMove", pointer(-0.23, 0));
      assert.deepEqual(seen.pop(), [0, 0]);
      camera.zoom = 200;
      camera.updateProjectionMatrix();
      await renderer.fireEvent(surface, "pointerMove", pointer(-0.23, 0));
      assert.notDeepEqual(
        seen.pop(),
        [0, 0],
        "zoom changes are read at the pointer event, not from draft.view",
      );
      await renderer.fireEvent(surface, "pointerMove", pointer(-0.119, 0.001));
      await renderer.fireEvent(surface, "pointerUp", pointer(-0.119, 0.001));
      assert.deepEqual(seen.splice(0), [
        [0, 0],
        [0, 0],
      ]);
      await renderer.fireEvent(surface, "pointerMove", pointer(-0.119, 0.001, true));
      await renderer.fireEvent(surface, "pointerUp", pointer(-0.119, 0.001, true));
      assert.deepEqual(seen, [
        [-0.119, 0.001],
        [-0.119, 0.001],
      ]);
    } finally {
      await renderer.unmount();
    }
  });

  test("guides measure transformed endpoints, hide zero lengths, and keep marker sizes on zoom", async () => {
    const camera = cameraAt(50);
    const props = {
      from: [10, -2],
      to: [13, 2],
      coordinates: { ...coordinates, origin: [10, -2], metersPerPlanUnit: 0.5 },
      planMode: true,
      showMarkers: true,
    };
    const renderer = await create(createElement(ConstructionWallGuide, props), {
      camera,
      width: 1000,
      height: 800,
    });
    try {
      assert.equal(
        renderer.scene.findByProps({ name: "construction-wall-guide" }).props.userData.label,
        "2.50 m",
      );
      const tip = renderer.scene.findByProps({ name: "construction-wall-tip-marker" });
      assert.deepEqual(tip.props.position, [1.5, 0.18, 2]);
      for (const zoom of [50, 200]) {
        camera.zoom = zoom;
        await renderer.advanceFrames(1, 0.016);
        assert.ok(Math.abs(tip.instance.scale.x * 0.055 * zoom - 7) < 1e-10);
      }
      for (const mesh of tip.children) assert.equal(mesh.props.raycast(), undefined);
      await renderer.update(createElement(ConstructionWallGuide, { ...props, to: props.from }));
      assert.equal(
        renderer.scene.findByProps({ name: "construction-wall-guide" }).props.userData.labelVisible,
        false,
      );
      assert.equal(
        renderer.scene.findAllByProps({ name: "construction-wall-tip-marker" }).length,
        0,
      );
    } finally {
      await renderer.unmount();
    }
    assert.match(
      renderToStaticMarkup(
        createElement(ConstructionDistanceLabel, { label: "2.50 m", ariaLabel: "Wall length" }),
      ),
      /aria-label="Wall length"[^>]*>2.50 m/,
    );
    assert.match(
      renderToStaticMarkup(
        createElement(ConstructionDistanceLabel, {
          label: "5.00 plan units · 2.50 m",
          onCopy() {},
        }),
      ),
      /Copy measurement: 5.00 plan units · 2.50 m/,
    );
  });

  test("the wall length label's unshifted HTML container cannot intercept the drawing pointer", async () => {
    const dom = new JSDOM("<!doctype html><body></body>");
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLCanvasElement: globalThis.HTMLCanvasElement,
    };
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLCanvasElement: dom.window.HTMLCanvasElement,
    });
    let renderer;
    try {
      renderer = await create(
        createElement(ConstructionWallGuide, {
          from: [0, 0],
          to: [1, 0],
          coordinates,
          planMode: true,
        }),
        {
          camera: cameraAt(100),
          width: 1000,
          height: 800,
          beforeReturn: (canvas) => dom.window.document.body.appendChild(canvas),
        },
      );
      const label = dom.window.document.querySelector('[aria-label="Wall length"]');
      assert.ok(label, "mount the real Html overlay, not only its Three.js group");
      // Moving the inner label aside leaves Html's centered box at the wall
      // midpoint. That box must also be transparent to pointer hit testing.
      const centeredContainer = label.parentElement.parentElement;
      assert.equal(dom.window.getComputedStyle(centeredContainer).pointerEvents, "none");
      assert.equal(dom.window.getComputedStyle(label).pointerEvents, "none");
    } finally {
      await renderer?.unmount();
      dom.window.close();
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
  });

  for (const tool of ["wall", "virtual-wall"]) {
    test(`${tool} previews stay transient, turn 90 degrees, and commit one undo step each`, async () => {
      let editor;
      function Harness() {
        editor = useConstructEditor(floor);
        return createElement(ConstructionEditLayer, {
          ...layerProps(),
          draft: editor.draft,
          coordinates: editor.draft.coordinates,
          tool: editor.tool,
          selection: editor.selection,
          drawStart: editor.drawStart,
          drawPreview: editor.drawPreview,
          drawAngleReferenceRadians: editor.drawAngleReferenceRadians,
          onBeginWall: editor.beginWall,
          onPreviewWall: editor.previewWall,
          onAddWall: editor.addWall,
          onCancelWall: editor.cancelWall,
        });
      }
      const renderer = await create(createElement(Harness), {
        camera: cameraAt(100),
        width: 1000,
        height: 800,
      });
      const surface = () => renderer.scene.findByProps({ name: "construction-placement-surface" });
      const guide = () =>
        renderer.scene.findByProps({ name: "construction-wall-guide" }).props.userData;
      try {
        await act(async () => editor.setTool(tool));
        const initialWalls = editor.draft.walls.length;
        await renderer.fireEvent(surface(), "pointerDown", pointer(20, 0));
        await renderer.fireEvent(surface(), "pointerMove", pointer(21, 0.2));
        assert.equal(guide().label, "1.02 m");
        assert.equal(editor.draft.walls.length, initialWalls);
        assert.equal(editor.history.past.length, 0);
        await renderer.fireEvent(surface(), "pointerUp", pointer(21, 0.2));
        assert.equal(editor.history.past.length, 1);
        assert.equal(guide().labelVisible, false);
        await renderer.fireEvent(surface(), "pointerMove", pointer(20.85, 1.21));
        assert.deepEqual(guide().to, [20.8, 1.2]);
        assert.equal(
          renderer.scene.findByProps({ name: "construction-angle-guide" }).props.userData.label,
          "90°",
        );
        const previousWallId = editor.draft.walls.at(-1).id;
        assert.equal(
          renderer.scene.findByProps({ name: `construction-wall-guide-${previousWallId}` }).props
            .userData.label,
          "1.02 m",
        );
        await renderer.fireEvent(surface(), "pointerUp", pointer(20.85, 1.21));
        assert.equal(editor.history.past.length, 2);
        await renderer.fireEvent(surface(), "pointerMove", pointer(19.79, 1.05));
        assert.deepEqual(guide().to, [19.8, 1]);
        assert.equal(
          renderer.scene.findByProps({ name: "construction-angle-guide" }).props.userData.label,
          "90°",
        );
        await renderer.fireEvent(surface(), "pointerUp", pointer(19.79, 1.05));
        assert.equal(editor.history.past.length, 3);
        assert.deepEqual(
          editor.draft.walls.slice(-3).map(({ from, to }) => [from, to]),
          [
            [
              [20, 0],
              [21, 0.2],
            ],
            [
              [21, 0.2],
              [20.8, 1.2],
            ],
            [
              [20.8, 1.2],
              [19.8, 1],
            ],
          ],
        );
        await renderer.fireEvent(surface(), "pointerMove", pointer(19, 2));
        await renderer.fireEvent(surface(), "pointerCancel", pointer(19, 2));
        assert.equal(editor.history.past.length, 3);
        assert.equal(renderer.scene.findAllByProps({ name: "construction-wall-guide" }).length, 0);
        assert.equal(
          renderer.scene.findAllByProps({ name: "construction-wall-measurements" }).length,
          0,
        );
        assert.equal(
          editor.draft.walls
            .slice(-3)
            .every((wall) => Boolean(wall.virtual) === (tool === "virtual-wall")),
          true,
        );
        await act(async () => editor.undo());
        assert.equal(editor.draft.walls.length, initialWalls + 2);
        await act(async () => editor.redo());
        assert.equal(editor.draft.walls.length, initialWalls + 3);
        assert.equal(Boolean(editor.draft.walls.at(-1).virtual), tool === "virtual-wall");
      } finally {
        await renderer.unmount();
      }
    });
  }

  test("new wall segments retain the last chosen exterior color", async () => {
    let editor;
    function Harness() {
      editor = useConstructEditor(floor, floor, "#c97370");
      return createElement("group");
    }
    const renderer = await create(createElement(Harness));
    try {
      await act(async () => editor.setExteriorWallColor("#b86f58"));
      await act(async () => editor.beginWall([20, 0]));
      await act(async () => editor.addWall([21, 0]));
      await act(async () => editor.addWall([21, 1]));
      assert.deepEqual(
        editor.draft.walls.slice(-2).map((wall) => wall.exteriorColor),
        ["#b86f58", "#b86f58"],
      );

      await act(async () => editor.setExteriorWallColor("#9b5e4b"));
      await act(async () => editor.addWall([20, 1]));
      assert.equal(editor.draft.walls.at(-1).exteriorColor, "#9b5e4b");
    } finally {
      await renderer.unmount();
    }
  });

  test("shared endpoint resizing labels the active preview and clears it on commit or cancellation", async () => {
    const moves = [];
    const walls = [
      { id: "horizontal", from: [0, 0], to: [2, 0] },
      { id: "vertical", from: [2, 0], to: [2, 2] },
    ];
    const props = {
      ...layerProps(walls),
      tool: "select",
      selection: { kind: "wall", id: "horizontal" },
      onMoveEndpoint: (...args) => moves.push(args),
    };
    const renderer = await create(createElement(ConstructionEditLayer, props), {
      camera: cameraAt(100),
      width: 1000,
      height: 800,
    });
    const endpoint = () =>
      renderer.scene.findByProps({ name: "construction-wall-endpoint-horizontal-to" });
    try {
      await renderer.fireEvent(endpoint(), "pointerDown", pointer(2, 0));
      await renderer.fireEvent(endpoint(), "pointerMove", pointer(3, 1, true));
      assert.equal(
        renderer.scene.findByProps({ name: "construction-wall-guide" }).props.userData.label,
        "3.16 m",
      );
      assert.equal(
        renderer.scene.findByProps({ name: "construction-wall-guide-vertical" }).props.userData
          .label,
        "1.41 m",
      );
      assert.equal(
        renderer.scene.findByProps({ name: "construction-angle-guide" }).props.userData.label,
        "63.4°",
      );
      assert.deepEqual(
        renderer.scene.findByProps({ name: "construction-wall-target-vertical" }).props.position,
        [2.5, 0.1, 1.5],
      );
      assert.equal(moves.length, 0);
      await renderer.fireEvent(endpoint(), "pointerCancel", pointer(3, 1));
      assert.equal(moves.length, 0);
      assert.equal(renderer.scene.findAllByProps({ name: "construction-wall-guide" }).length, 0);
      assert.equal(
        renderer.scene.findAllByProps({ name: "construction-wall-measurements" }).length,
        0,
      );
      await renderer.fireEvent(endpoint(), "pointerDown", pointer(2, 0));
      await renderer.fireEvent(endpoint(), "pointerMove", pointer(3, 1, true));
      await renderer.fireEvent(endpoint(), "pointerUp", pointer(3, 1, true));
      assert.deepEqual(moves, [["horizontal", "to", [3, 1]]]);
      assert.equal(renderer.scene.findAllByProps({ name: "construction-wall-guide" }).length, 0);
      assert.equal(renderer.scene.findAllByProps({ name: "construction-angle-guide" }).length, 0);
      await renderer.fireEvent(endpoint(), "pointerDown", pointer(2, 0));
      await renderer.fireEvent(endpoint(), "pointerMove", pointer(3, 1, true));
      await renderer.update(createElement(ConstructionEditLayer, { ...props, selection: null }));
      assert.equal(
        renderer.scene.findAllByProps({ name: "construction-wall-guide" }).length,
        0,
        "Escape/selection clearing cancels the transient resize",
      );
      assert.deepEqual(
        renderer.scene.findByProps({ name: "construction-wall-target-vertical" }).props.position,
        [2, 0.1, 1],
      );
      assert.equal(moves.length, 1);
    } finally {
      await renderer.unmount();
    }
  });

  test("a snapped shared-corner edit commits once and undo restores both connected walls", async () => {
    let editor;
    function Harness() {
      editor = useConstructEditor(floor);
      return createElement(ConstructionEditLayer, {
        ...layerProps(),
        draft: editor.draft,
        coordinates: editor.draft.coordinates,
        tool: editor.tool,
        selection: editor.selection,
        onMoveEndpoint: (wallId, endpoint, point) =>
          editor.dispatch({ type: "move-wall-endpoint", wallId, endpoint, point }),
      });
    }
    const renderer = await create(createElement(Harness), {
      camera: cameraAt(100),
      width: 1000,
      height: 800,
    });
    try {
      await act(async () => {
        editor.dispatch({ type: "add-wall", from: [20, 0], to: [22, 1.85] });
        editor.dispatch({ type: "add-wall", from: [22, 1.85], to: [22, 4] });
        editor.setTool("select");
      });
      const activeWall = editor.draft.walls.at(-2);
      await act(async () => editor.selectWall(activeWall.id));
      const originalWalls = editor.draft.walls;
      const historySize = editor.history.past.length;
      const endpoint = () =>
        renderer.scene.findByProps({ name: `construction-wall-endpoint-${activeWall.id}-to` });
      await renderer.fireEvent(endpoint(), "pointerDown", pointer(22, 1.85));
      await renderer.fireEvent(endpoint(), "pointerMove", pointer(22, 1.93));
      const guide = renderer.scene.findByProps({ name: "construction-wall-guide" }).props.userData;
      assert.deepEqual(guide.to, [22, 2]);
      assert.equal(guide.label, "2.83 m");
      assert.equal(editor.draft.walls, originalWalls);
      assert.equal(editor.history.past.length, historySize);
      await renderer.fireEvent(endpoint(), "pointerUp", pointer(22, 1.93));
      assert.deepEqual(
        editor.draft.walls.slice(-2).map(({ from, to }) => [from, to]),
        [
          [
            [20, 0],
            [22, 2],
          ],
          [
            [22, 2],
            [22, 4],
          ],
        ],
      );
      assert.equal(editor.history.past.length, historySize + 1);
      assert.equal(renderer.scene.findAllByProps({ name: "construction-wall-guide" }).length, 0);
      await act(async () => editor.dispatch({ type: "undo" }));
      assert.deepEqual(editor.draft.walls, originalWalls);
    } finally {
      await renderer.unmount();
    }
  });
  test("all segment tools display an alignment guide and commit the previewed U endpoint", async () => {
    const points = [
      [0, 0],
      [0, 3],
      [4, 3],
    ];
    const walls = [
      { id: "one", from: points[0], to: points[1] },
      { id: "two", from: points[1], to: points[2] },
    ];
    for (const tool of ["wall", "hedge", "pool", "floor"]) {
      const previews = [],
        commits = [];
      const props = {
        ...layerProps(walls),
        tool,
        drawStart: points[2],
        drawPreview: points[2],
        drawAngleReferenceRadians: 0,
        ...(tool === "pool" ? { poolPoints: points } : {}),
        ...(tool === "floor"
          ? {
              floorPaintTarget: "custom-area",
              floorZonePoints: points,
              floorZonePreview: points[2],
            }
          : {}),
        onPreviewWall: (point) => previews.push(point),
        onAddWall: (point) => commits.push(point),
        onPreviewFloorZonePoint: (point) => previews.push(point),
        onPlaceFloorZonePoint: (point) => commits.push(point),
      };
      const renderer = await create(createElement(ConstructionEditLayer, props), {
        camera: cameraAt(100),
        width: 1000,
        height: 800,
      });
      try {
        const surface = () =>
          renderer.scene.findByProps({ name: "construction-placement-surface" });
        await renderer.fireEvent(surface(), "pointerMove", pointer(4, 0.12));
        assert.deepEqual(previews.at(-1), [4, 0]);
        assert.equal(
          renderer.scene.findAllByProps({ name: "construction-alignment-guide" }).length,
          1,
        );
        await renderer.fireEvent(surface(), "pointerUp", pointer(4, 0.12));
        assert.deepEqual(commits.at(-1), previews.at(-1));
        await renderer.fireEvent(surface(), "pointerMove", pointer(4, 0.12, true));
        assert.deepEqual(previews.at(-1), [4, 0.12]);
        assert.equal(
          renderer.scene.findAllByProps({ name: "construction-alignment-guide" }).length,
          0,
        );
      } finally {
        await renderer.unmount();
      }
    }
  });

  test("a starting click on a wall with pointer jitter only anchors the next segment", async () => {
    for (const pointerType of ["mouse", "pen", "touch"]) {
      let editor;
      function Harness() {
        editor = useConstructEditor(floor);
        return createElement(ConstructionEditLayer, {
          ...layerProps(),
          draft: editor.draft,
          coordinates: editor.draft.coordinates,
          rooms: editor.previewFloor.rooms,
          tool: editor.tool,
          selection: editor.selection,
          drawStart: editor.drawStart,
          drawPreview: editor.drawPreview,
          drawAngleReferenceRadians: editor.drawAngleReferenceRadians,
          onBeginWall: editor.beginWall,
          onPreviewWall: editor.previewWall,
          onAddWall: editor.addWall,
          onCancelWall: editor.cancelWall,
        });
      }
      const renderer = await create(createElement(Harness), {
        camera: cameraAt(100),
        width: 1000,
        height: 800,
      });
      try {
        await act(async () => {
          editor.dispatch({ type: "add-wall", from: [20, 0], to: [24, 0] });
          editor.setTool("wall");
        });
        const surface = () =>
          renderer.scene.findByProps({ name: "construction-placement-surface" });
        const walls = editor.draft.walls;
        const historySize = editor.history.past.length;
        await renderer.fireEvent(surface(), "pointerDown", pointer(22, 0.05, false, pointerType));
        await renderer.fireEvent(
          surface(),
          "pointerMove",
          pointer(22.02, 0.05, false, pointerType),
        );
        await renderer.fireEvent(surface(), "pointerUp", pointer(22.02, 0.05, false, pointerType));
        assert.equal(
          editor.draft.walls,
          walls,
          `${pointerType}: a click must not create a sliver wall`,
        );
        assert.equal(editor.history.past.length, historySize);
        assert.deepEqual(editor.drawStart, [22, 0]);
        assert.deepEqual(editor.drawPreview, [22, 0]);
        // A following click at a new position is still a valid segment gesture.
        await renderer.fireEvent(surface(), "pointerDown", pointer(22, 2, false, pointerType));
        await renderer.fireEvent(surface(), "pointerUp", pointer(22, 2, false, pointerType));
        assert.deepEqual(editor.draft.walls.at(-1).from, [22, 0]);
        assert.deepEqual(editor.draft.walls.at(-1).to, [22, 2]);
        assert.equal(editor.history.past.length, historySize + 1);
      } finally {
        await renderer.unmount();
      }
    }
  });

  test("a divider keeps its angle through the destination wall preview and commit", async () => {
    const walls = [
      { id: "top", from: [0, 0], to: [6, 0] },
      { id: "opposite", from: [0, 4.137], to: [6, 4.137] },
    ];
    const previews = [],
      commits = [];
    const renderer = await create(
      createElement(ConstructionEditLayer, {
        ...layerProps(walls),
        drawStart: [2.173, 0],
        drawPreview: [2.173, 0],
        onPreviewWall: (point) => previews.push(point),
        onAddWall: (point) => commits.push(point),
      }),
      { camera: cameraAt(100), width: 1000, height: 800 },
    );
    try {
      const surface = () => renderer.scene.findByProps({ name: "construction-placement-surface" });
      await renderer.fireEvent(surface(), "pointerMove", pointer(2.253, 4.08));
      assert.ok(Math.abs(previews.at(-1)[0] - 2.173) < 1e-10);
      assert.equal(previews.at(-1)[1], 4.137);
      await renderer.fireEvent(surface(), "pointerUp", pointer(2.253, 4.08));
      assert.deepEqual(commits.at(-1), previews.at(-1));
      await renderer.fireEvent(surface(), "pointerMove", pointer(2.253, 4.08, true));
      assert.deepEqual(previews.at(-1), [2.253, 4.08]);
    } finally {
      await renderer.unmount();
    }
  });
});
