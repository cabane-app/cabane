import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { Vector3, Raycaster, Plane, Vector2 } from "three";
import { create } from "@react-three/test-renderer";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await withModules(async (load) => {
  const { OrbitCamera } = await load("/packages/engine/src/OrbitCamera.tsx");
  const { PreviewCamera } = await load("/apps/web/src/editor-preview/PreviewCamera.tsx");
  const { deriveFloorTopology } = await load("/packages/engine/src/index.ts");
  const walls = [
    { id: "north", from: [0, 0], to: [4, 0] },
    { id: "east", from: [4, 0], to: [4, 3] },
    { id: "south", from: [4, 3], to: [0, 3] },
    { id: "west", from: [0, 3], to: [0, 0] },
  ];
  const derive = (walls) =>
    deriveFloorTopology({ floorId: "floor", floorName: "Floor", walls, openings: [], rooms: [] })
      .floor;
  const floor = derive(walls);
  const extendedFloor = derive([
    ...walls,
    { id: "extension-north", from: [4, 0], to: [10, 0] },
    { id: "extension-east", from: [10, 0], to: [10, 3] },
    { id: "extension-south", from: [10, 3], to: [4, 3] },
  ]);
  const controlsFor = (renderer) =>
    renderer.scene.find(
      (node) => node.instance?.target && node.instance?.object?.isOrthographicCamera,
    ).instance;
  const pose = (controls) => ({
    position: controls.object.position.toArray(),
    quaternion: controls.object.quaternion.toArray(),
    target: controls.target.toArray(),
    zoom: controls.object.zoom,
  });
  const options = {
    width: 1000,
    height: 800,
    beforeReturn(canvas) {
      canvas.ownerDocument = { addEventListener() {}, removeEventListener() {} };
    },
  };
  const cameraProps = (overrides = {}) => ({
    view: "top",
    resetKey: 0,
    floor,
    controlsEnabled: true,
    focusPoint: null,
    onTargetChange() {},
    savedCamera: { current: null },
    ...overrides,
  });

  const createWheelCamera = async (element) => {
    const listeners = new Map();
    if (element.props.savedCamera) element.props.savedCamera.current = null;
    const renderer = await create(element, {
      ...options,
      beforeReturn(canvas) {
        options.beforeReturn(canvas);
        canvas.clientWidth = 1000;
        canvas.clientHeight = 800;
        canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
        canvas.addEventListener = (type, listener, options) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type).add({ listener, capture: options?.capture === true });
        };
        canvas.removeEventListener = (type, listener) => {
          for (const entry of listeners.get(type) ?? [])
            if (entry.listener === listener) listeners.get(type).delete(entry);
        };
      },
    });
    await renderer.advanceFrames(1, 1 / 60);
    const wheel = async (deltaY, overrides = {}) => {
      await act(async () => {
        let stopped = false;
        const ordered = [...(listeners.get("wheel") ?? [])].sort(
          (a, b) => Number(b.capture) - Number(a.capture),
        );
        for (const { listener } of ordered) {
          if (stopped) break;
          listener({
            deltaY,
            deltaX: 0,
            deltaMode: 0,
            clientX: 500,
            clientY: 400,
            preventDefault() {},
            stopImmediatePropagation() {
              stopped = true;
            },
            ...overrides,
          });
        }
      });
    };
    return { renderer, wheel, listeners, controls: controlsFor(renderer) };
  };

  for (const [name, element] of [
    ["orbit", createElement(OrbitCamera, { floor, resetKey: 0 })],
    ["editor top", createElement(PreviewCamera, cameraProps())],
    ["editor 3D", createElement(PreviewCamera, cameraProps({ view: "3d" }))],
  ]) {
    test(`${name} wheel zoom responds immediately and follows scroll distance, not event count`, async () => {
      const { renderer, controls, wheel } = await createWheelCamera(element);
      try {
        const initial = controls.object.zoom;
        await wheel(100);
        const coarse = controls.object.zoom;
        assert.ok(coarse < initial * 0.9, "a mouse step must produce a useful immediate response");
        await wheel(-100);
        assert.ok(Math.abs(controls.object.zoom - initial) < 1e-8, "opposite scroll reverses zoom");
        for (let index = 0; index < 10; index++) await wheel(10);
        assert.ok(
          Math.abs(controls.object.zoom - coarse) < 1e-8,
          "equal distances yield equal zoom",
        );
        await renderer.advanceFrames(10, 1 / 60);
        assert.ok(
          Math.abs(controls.object.zoom - coarse) < 1e-8,
          "wheel zoom must not have a damping tail",
        );
        await wheel(0, { deltaX: 20 });
        assert.ok(Math.abs(controls.object.zoom - coarse) < 1e-8, "horizontal input does not zoom");
        await wheel(-10, { ctrlKey: true });
        assert.ok(controls.object.zoom > coarse * 1.09, "trackpad pinch retains its sensitivity");
      } finally {
        await renderer.unmount();
      }
    });

    if (name === "orbit")
      test("Orbit stops zooming out while the home remains at 70% of overview scale", async () => {
        const { renderer, controls, wheel } = await createWheelCamera(element);
        try {
          const initial = pose(controls);
          await wheel(10000, { clientX: 750, clientY: 150 });
          assert.equal(controls.object.zoom, initial.zoom * 0.7);
          const atLimit = pose(controls);
          for (let i = 0; i < 20; i++) await wheel(200, { clientX: 750, clientY: 150 });
          assert.deepEqual(
            pose(controls),
            atLimit,
            "further scrolling cannot zoom or push the home away",
          );
        } finally {
          await renderer.unmount();
        }
      });

    test(`${name} zooming out off-center preserves the orbit distance and direction`, async () => {
      const { renderer, controls, wheel } = await createWheelCamera(element);
      try {
        const offset = controls.object.position.clone().sub(controls.target);
        const initial = pose(controls);
        for (let i = 0; i < 12; i++) {
          await wheel(150, { clientX: 750, clientY: 150 });
          controls.update();
        }
        const after = controls.object.position.clone().sub(controls.target);
        assert.ok(
          after.distanceTo(offset) < 1e-7,
          `zoom changed orbit offset: ${offset.toArray()} -> ${after.toArray()}`,
        );
        controls.update();
        assert.ok(controls.object.position.clone().sub(controls.target).distanceTo(offset) < 1e-7);
        const reverseDistance =
          Math.log(initial.zoom / controls.object.zoom) / (0.0015 * controls.zoomSpeed);
        await wheel(-reverseDistance, { clientX: 750, clientY: 150 });
        controls.update();
        assert.ok(Math.abs(controls.object.zoom - initial.zoom) < 1e-7);
        assert.ok(controls.target.distanceTo(new Vector3(...initial.target)) < 1e-7);
        assert.ok(controls.object.position.distanceTo(new Vector3(...initial.position)) < 1e-7);
      } finally {
        await renderer.unmount();
      }
    });

    test(`${name} wheel zoom preserves its cursor anchor, normalizes units and respects limits`, async () => {
      const { renderer, controls, wheel, listeners } = await createWheelCamera(element);
      try {
        const camera = controls.object;
        camera.updateMatrixWorld();
        const anchor = controls.target.clone().set(0.5, 0.2, 0.5);
        const projected = anchor.clone().project(camera);
        const targetHeight = controls.target.y;
        const cursor = { clientX: (projected.x + 1) * 500, clientY: (1 - projected.y) * 400 };
        await wheel(-30, cursor);
        await renderer.advanceFrames(1, 1 / 60);
        camera.updateMatrixWorld();
        const after = anchor.clone().project(camera);
        assert.ok(Math.hypot(after.x - projected.x, after.y - projected.y) < 1e-8);
        assert.ok(
          Math.abs(controls.target.y - targetHeight) < 1e-8,
          "orbit pivot stays on its plane",
        );
        const initial = camera.zoom;
        await wheel(1, { deltaMode: 1 });
        const line = camera.zoom;
        await wheel(-16);
        assert.ok(Math.abs(camera.zoom - initial) < 1e-8);
        await wheel(16);
        assert.ok(Math.abs(camera.zoom - line) < 1e-8, "one line equals 16 pixels");
        await wheel(0.25, { deltaMode: 2 });
        const page = camera.zoom;
        await wheel(-200);
        assert.ok(Math.abs(camera.zoom - line) < 1e-8, "quarter-page input uses viewport height");
        assert.ok(page < line);
        await wheel(-10000);
        assert.equal(camera.zoom, 300, "small devices need a useful close-up ceiling");
        const direction = new Vector3();
        camera.getWorldDirection(direction);
        const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const center = controls.target.clone();
        const edge = center.clone().addScaledVector(right, 0.04);
        const screen = center.clone().project(camera);
        const edgeScreen = edge.clone().project(camera);
        assert.ok(
          Math.abs(edgeScreen.x - screen.x) * 500 > 11.9,
          "a 4 cm sensor spans 12 CSS pixels",
        );
        assert.ok(
          screen.z > -1 && screen.z < 1,
          "close zoom keeps the target inside clipping planes",
        );
        const ray = new Raycaster();
        ray.setFromCamera(new Vector2(screen.x + 3 / 500, screen.y), camera);
        const hit = ray.ray.intersectPlane(
          new Plane().setFromNormalAndCoplanarPoint(direction, center),
          new Vector3(),
        );
        assert.ok(
          Math.abs(hit.distanceTo(center) - 0.01) < 1e-8,
          "three screen pixels resolve a 10 mm placement adjustment",
        );
        const atLimit = pose(controls);
        await wheel(-10, cursor);
        assert.deepEqual(pose(controls), atLimit, "clamping must not move the cursor anchor");
        await wheel(10000);
        assert.equal(camera.zoom, controls.minZoom);
        controls.enabled = false;
        await wheel(-100);
        assert.equal(camera.zoom, controls.minZoom, "disabled controls ignore wheel input");
        controls.enabled = true;
        controls.enableZoom = false;
        await wheel(-100);
        assert.equal(camera.zoom, controls.minZoom, "disabled zoom ignores wheel input");
      } finally {
        await renderer.unmount();
      }
      assert.equal(listeners.get("wheel").size, 0, "unmount removes wheel listeners");
    });
  }

  test("active orthographic controls keep foreground geometry out of the near clipping plane", async () => {
    const { renderer, controls } = await createWheelCamera(
      createElement(OrbitCamera, { floor, resetKey: 0 }),
    );
    try {
      const camera = controls.object;
      const target = controls.target.clone();
      const direction = camera.position.clone().sub(target).normalize();
      camera.zoom = 160;
      camera.updateProjectionMatrix();
      camera.position.copy(target).add(direction);
      controls.update();
      camera.updateMatrixWorld();
      const foreground = target.clone().addScaledVector(direction, 2);
      const screen = foreground.project(camera);
      assert.ok(Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1, "the face is on screen");
      assert.ok(screen.z >= -1 && screen.z <= 1, `foreground face clipped at depth ${screen.z}`);
      assert.ok(camera.position.distanceTo(controls.target) > 2);
      assert.equal(camera.zoom, 160, "safe camera depth does not change magnification");
      assert.deepEqual(controls.target.toArray(), target.toArray());
    } finally {
      await renderer.unmount();
    }
  });

  test("large home overview stays inside the far clipping plane", async () => {
    const large = { ...floor, coordinates: { ...floor.coordinates, metersPerPlanUnit: 50 } };
    const { renderer, controls } = await createWheelCamera(
      createElement(OrbitCamera, { floor: large, resetKey: 0 }),
    );
    try {
      controls.object.updateMatrixWorld();
      const center = controls.target.clone().project(controls.object);
      assert.ok(center.z >= -1 && center.z <= 1, `overview clipped at depth ${center.z}`);
    } finally {
      await renderer.unmount();
    }
  });

  test("locked orbit blocks wheel and double-tap zoom, then resumes normal input", async () => {
    const props = { floor, resetKey: 0, locked: true };
    const { renderer, controls, wheel, listeners } = await createWheelCamera(
      createElement(OrbitCamera, props),
    );
    const tap = async (time) => {
      await act(async () => {
        for (const type of ["pointerdown", "pointerup"]) {
          const event = {
            pointerType: "touch",
            pointerId: 1,
            clientX: 500,
            clientY: 400,
            pageX: 500,
            pageY: 400,
            timeStamp: time,
            preventDefault() {},
          };
          for (const { listener } of listeners.get(type) ?? []) listener(event);
        }
      });
    };
    try {
      const initial = pose(controls);
      await wheel(-100);
      await tap(1000);
      await tap(1100);
      await renderer.advanceFrames(10, 1 / 60);
      assert.deepEqual(pose(controls), initial);
      await renderer.update(createElement(OrbitCamera, { ...props, locked: false }));
      await wheel(-100);
      assert.ok(controls.object.zoom > initial.zoom);
      // Disable only native pointer controls to exercise the separate tap handler.
      controls.enablePan = false;
      controls.enableRotate = false;
      const zoom = controls.object.zoom;
      await tap(2000);
      await tap(2100);
      assert.ok(controls.object.zoom > zoom);
      controls.object.zoom = 240;
      await tap(3000);
      await tap(3100);
      assert.equal(controls.object.zoom, 300, "double-tap shares the close-up ceiling");
    } finally {
      await renderer.unmount();
    }
  });

  test("construction wheel pans without clicking even when pointer controls are disabled, and pinch zooms", async () => {
    const listeners = new Map();
    const props = cameraProps({ planWheelNavigation: true, controlsEnabled: false });
    const renderer = await create(createElement(PreviewCamera, props), {
      ...options,
      beforeReturn(canvas) {
        options.beforeReturn(canvas);
        canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
        const add = canvas.addEventListener.bind(canvas);
        const remove = canvas.removeEventListener.bind(canvas);
        canvas.addEventListener = (type, listener, options) => {
          if (type === "wheel" && options?.capture) listeners.set(type, listener);
          add(type, listener, options);
        };
        canvas.removeEventListener = (type, listener, options) => {
          if (listeners.get(type) === listener) listeners.delete(type);
          remove(type, listener, options);
        };
      },
    });
    try {
      const controls = controlsFor(renderer);
      controls.object.lookAt(controls.target);
      const before = pose(controls);
      let prevented = 0;
      const wheel = (overrides = {}) =>
        listeners.get("wheel")({
          deltaX: 80,
          deltaY: 40,
          deltaMode: 0,
          clientX: 500,
          clientY: 400,
          preventDefault() {
            prevented++;
          },
          stopImmediatePropagation() {},
          ...overrides,
        });
      await act(async () => wheel());
      assert.equal(controls.object.zoom, before.zoom);
      assert.ok(Math.abs(controls.target.x - before.target[0] - 80 / before.zoom) < 1e-8);
      assert.ok(controls.target.z > before.target[2]);
      assert.deepEqual(props.savedCamera.current.target, controls.target.toArray());
      const panned = pose(controls);
      await act(async () => wheel({ ctrlKey: true, deltaY: -10 }));
      assert.ok(controls.object.zoom > before.zoom);
      assert.deepEqual(controls.target.toArray(), panned.target, "center pinch preserves target");
      assert.equal(prevented, 2);
      const planWheel = listeners.get("wheel");
      await renderer.update(createElement(PreviewCamera, { ...props, planWheelNavigation: false }));
      assert.notEqual(
        listeners.get("wheel"),
        planWheel,
        "leaving Construct removes the plan override",
      );
    } finally {
      await renderer.unmount();
    }
  });

  test("orbit touch rotation and pan survive a parent render during the gesture", async () => {
    const elementListeners = new Map();
    const documentListeners = new Map();
    const target = (listeners) => ({
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener(type, listener) {
        listeners.get(type)?.delete(listener);
      },
    });
    const dispatch = (listeners, type, pointerId, x, y) => {
      const event = {
        pointerId,
        pointerType: "touch",
        clientX: x,
        clientY: y,
        pageX: x,
        pageY: y,
        preventDefault() {},
        timeStamp: 1000,
      };
      for (const listener of listeners.get(type) ?? []) listener(event);
    };
    const props = { floor, resetKey: 0 };
    const renderer = await create(createElement(OrbitCamera, props), {
      ...options,
      beforeReturn(canvas) {
        Object.assign(canvas, target(elementListeners));
        canvas.ownerDocument = target(documentListeners);
        canvas.clientWidth = 1000;
        canvas.clientHeight = 800;
        canvas.setPointerCapture = () => {};
        canvas.releasePointerCapture = () => {};
        canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
      },
    });
    try {
      const controls = controlsFor(renderer);
      controls.enableDamping = false;
      controls.object.zoom = 240;
      controls.object.updateProjectionMatrix();
      await act(async () => {
        dispatch(elementListeners, "pointerdown", 1, 400, 400);
        dispatch(elementListeners, "pointerdown", 2, 600, 400);
        dispatch(documentListeners, "pointermove", 1, 370, 400);
      });
      assert.ok(controls.object.zoom > 240, "native touch pinch can zoom beyond the old ceiling");
      const before = controls.getAzimuthalAngle();
      await renderer.update(createElement(OrbitCamera, { ...props }));
      await act(async () => {
        dispatch(documentListeners, "pointermove", 1, 480, 400);
        dispatch(documentListeners, "pointermove", 2, 680, 400);
      });
      assert.notEqual(
        controls.getAzimuthalAngle(),
        before,
        "two-finger rotation must continue after a parent render",
      );
      await act(async () => {
        dispatch(documentListeners, "pointerup", 1, 480, 400);
        dispatch(documentListeners, "pointerup", 2, 680, 400);
      });
      const beforePan = controls.target.toArray();
      await act(async () => dispatch(elementListeners, "pointerdown", 3, 400, 400));
      await renderer.update(createElement(OrbitCamera, { ...props }));
      await act(async () => dispatch(documentListeners, "pointermove", 3, 500, 430));
      assert.notDeepEqual(
        controls.target.toArray(),
        beforePan,
        "one-finger pan must still work after the rotation ends",
      );
      const panDistance = controls.target.distanceTo(new Vector3(...beforePan));
      assert.ok(panDistance < 0.15, "close-up pan remains proportional to screen distance");
      await act(async () => dispatch(documentListeners, "pointerup", 3, 500, 430));
    } finally {
      await renderer.unmount();
    }
  });

  test("orbit camera preserves the live pose when roof visibility or active floors change", async () => {
    const upper = { ...extendedFloor, id: "upper" };
    const props = { floor, buildingFloors: [floor], resetKey: 0 };
    const renderer = await create(createElement(OrbitCamera, props), options);
    try {
      const controls = controlsFor(renderer);
      controls.object.position.x += 3;
      controls.target.x += 3;
      controls.object.zoom = 75;
      controls.object.updateProjectionMatrix();
      controls.update();
      const before = pose(controls);
      for (const change of [
        { showRoof: true, buildingFloors: [floor, upper] },
        { floor: upper, elevation: 3, buildingFloors: [floor, upper] },
        { showRoof: false },
      ]) {
        await renderer.update(createElement(OrbitCamera, { ...props, ...change }));
        assert.equal(controlsFor(renderer), controls);
        assert.deepEqual(pose(controls), before);
      }
      await renderer.update(createElement(OrbitCamera, { ...props, resetKey: 1 }));
      assert.notEqual(controlsFor(renderer), controls, "explicit reset still reframes");
    } finally {
      await renderer.unmount();
    }
  });

  for (const view of ["top", "3d"]) {
    test(`${view} camera preserves pan and zoom when a wall closes a new room and on undo/redo`, async () => {
      assert.equal(floor.rooms.length, 1);
      assert.equal(extendedFloor.rooms.length, 2);
      assert.notDeepEqual(floor.footprint, extendedFloor.footprint);
      const props = cameraProps({ view });
      const renderer = await create(createElement(PreviewCamera, props), options);
      try {
        const controls = controlsFor(renderer);
        controls.object.position.x += 1.5;
        controls.object.position.z -= 2;
        controls.target.x += 1.5;
        controls.target.z -= 2;
        controls.object.zoom = 75;
        controls.object.updateProjectionMatrix();
        controls.update();
        const before = pose(controls);
        for (const nextFloor of [
          floor,
          extendedFloor,
          { ...extendedFloor, id: "upper" },
          floor,
          extendedFloor,
        ]) {
          await renderer.update(
            createElement(PreviewCamera, { ...props, floor: nextFloor, controlsEnabled: false }),
          );
          await renderer.update(
            createElement(PreviewCamera, { ...props, floor: nextFloor, controlsEnabled: true }),
          );
          assert.equal(controlsFor(renderer), controls, "editing must not remount controls");
          assert.deepEqual(pose(controls), before, "topology edits must not refit the camera");
        }
      } finally {
        await renderer.unmount();
      }
    });
  }

  test("viewport resizing preserves camera pose and zoom while updating the frustum", async () => {
    let state;
    const props = cameraProps();
    const renderer = await create(createElement(PreviewCamera, props), {
      ...options,
      onCreated(value) {
        state = value;
      },
    });
    try {
      const controls = controlsFor(renderer);
      controls.object.zoom = 65;
      controls.object.position.x += 2;
      controls.target.x += 2;
      controls.update();
      const before = pose(controls);
      await act(async () => state.setSize(600, 400));
      assert.deepEqual(pose(controls), before);
      assert.equal(controls.object.right - controls.object.left, 600);
      assert.equal(controls.object.top - controls.object.bottom, 400);
    } finally {
      await renderer.unmount();
    }
  });

  test("Properties changes preserve the camera pose and projected scene position", async () => {
    const props = cameraProps();
    const renderer = await create(createElement(PreviewCamera, props), {
      ...options,
      beforeReturn(canvas) {
        options.beforeReturn(canvas);
        canvas.ownerDocument.defaultView = { matchMedia: () => ({ matches: true }) };
      },
    });
    try {
      const controls = controlsFor(renderer);
      controls.object.zoom = 65;
      controls.object.position.x += 2;
      controls.target.x += 2;
      controls.update();
      controls.object.updateProjectionMatrix();
      const before = pose(controls);
      controls.object.updateMatrixWorld(true);
      const projectedTarget = controls.target.clone().project(controls.object);
      const projection = controls.object.projectionMatrix.toArray();
      await renderer.update(createElement(PreviewCamera, { ...props, rightPanelOpen: true }));
      assert.deepEqual(pose(controls), before);
      assert.equal(controls.object.view?.enabled ?? false, false);
      controls.object.updateMatrixWorld(true);
      assert.ok(
        controls.target.clone().project(controls.object).distanceTo(projectedTarget) < 1e-10,
      );
      assert.deepEqual(controls.object.projectionMatrix.toArray(), projection);
      await renderer.update(createElement(PreviewCamera, props));
      assert.deepEqual(pose(controls), before);
      assert.deepEqual(controls.object.projectionMatrix.toArray(), projection);
    } finally {
      await renderer.unmount();
    }
  });

  test("pool edits preserve the camera until overview is explicitly reset to include the rim", async () => {
    const props = cameraProps();
    const renderer = await create(createElement(PreviewCamera, props), options);
    const withPool = {
      ...floor,
      pools: [
        {
          id: "pool",
          polygon: [
            [15, 0],
            [19, 0],
            [19, 3],
            [15, 3],
          ],
        },
      ],
    };
    try {
      const initial = pose(controlsFor(renderer));
      await renderer.update(createElement(PreviewCamera, { ...props, floor: withPool }));
      assert.deepEqual(pose(controlsFor(renderer)), initial);
      await renderer.update(
        createElement(PreviewCamera, { ...props, floor: withPool, resetKey: 1 }),
      );
      const reset = pose(controlsFor(renderer));
      assert.deepEqual(reset.target, [9.625, 0.2, 1.5]);
      assert.ok(reset.zoom < initial.zoom);
    } finally {
      await renderer.unmount();
    }
  });

  test("edit renders do not detach active camera pointer listeners", async () => {
    const removed = [];
    const props = cameraProps();
    const renderer = await create(createElement(PreviewCamera, props), {
      ...options,
      beforeReturn(canvas) {
        canvas.ownerDocument = {
          addEventListener() {},
          removeEventListener(type) {
            removed.push(type);
          },
        };
      },
    });
    try {
      removed.length = 0;
      await renderer.update(
        createElement(PreviewCamera, { ...props, floor: extendedFloor, controlsEnabled: false }),
      );
      await renderer.update(
        createElement(PreviewCamera, { ...props, floor: extendedFloor, controlsEnabled: true }),
      );
      assert.deepEqual(
        removed,
        [],
        "disposing controls during a gesture loses its pointer-up cleanup",
      );
    } finally {
      await renderer.unmount();
    }
  });

  test("explicit focus and view changes still frame the latest floor", async () => {
    const props = cameraProps();
    const renderer = await create(createElement(PreviewCamera, props), options);
    try {
      const initialControls = controlsFor(renderer);
      await renderer.update(
        createElement(PreviewCamera, {
          ...props,
          floor: extendedFloor,
          resetKey: 1,
          focusPoint: [8, 2],
        }),
      );
      const focused = controlsFor(renderer);
      assert.notEqual(focused, initialControls);
      assert.deepEqual(focused.target.toArray(), [8, 0.2, 2]);
      assert.equal(focused.object.zoom, (1000 / (10 * 1.48)) * 2.25);
      const focusedPose = pose(focused);
      await renderer.update(
        createElement(PreviewCamera, { ...props, floor, resetKey: 1, focusPoint: [8, 2] }),
      );
      assert.deepEqual(pose(focused), focusedPose, "edits after focusing must not reframe either");
      await renderer.update(
        createElement(PreviewCamera, { ...props, floor: extendedFloor, view: "3d", resetKey: 1 }),
      );
      const overview = controlsFor(renderer);
      assert.notEqual(overview, focused);
      assert.deepEqual(overview.target.toArray(), [5, 0.2, 1.5]);
      assert.equal(overview.object.zoom, 1000 / (10 * 1.48));
      assert.equal(overview.enableRotate, true);
    } finally {
      await renderer.unmount();
    }
  });

  test("saved camera restoration survives edits but does not override an explicit focus", async () => {
    const saved = { view: "top", position: [3, 18, 2.001], target: [3, 0.2, 2], zoom: 82 };
    const props = cameraProps({ savedCamera: { current: saved } });
    const renderer = await create(createElement(PreviewCamera, props), options);
    try {
      const controls = controlsFor(renderer);
      assert.equal(controls.object.zoom, saved.zoom);
      assert.deepEqual(controls.target.toArray(), saved.target);
      const before = pose(controls);
      await renderer.update(createElement(PreviewCamera, { ...props, floor: extendedFloor }));
      assert.deepEqual(pose(controls), before);
      await renderer.update(
        createElement(PreviewCamera, {
          ...props,
          floor: extendedFloor,
          resetKey: 1,
          focusPoint: [8, 2],
        }),
      );
      assert.deepEqual(controlsFor(renderer).target.toArray(), [8, 0.2, 2]);
      assert.notEqual(controlsFor(renderer).object.zoom, saved.zoom);
    } finally {
      await renderer.unmount();
    }
  });
});
