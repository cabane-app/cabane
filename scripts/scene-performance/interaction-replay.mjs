import assert from "node:assert/strict";

// Measurement-only input replay. Scene access observes picking/camera state;
// all editor mutations and Walk movement come from trusted browser input.
const defaultItemId = "solstice-curved-three-seat-sofa-2";
const selection = (page, id) => page.locator(`.selected-item-controls[data-item-id="${id}"]`);
const percentile = (values, fraction) => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
};
const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b),
    middle = sorted.length / 2;
  return sorted.length ? (sorted[Math.ceil(middle) - 1] + sorted[Math.floor(middle)]) / 2 : 0;
};

export async function installInteractionProbe(page) {
  await page.evaluate(() => {
    let active;
    const root = () => window.__cabanePerf.root();
    const canvas = () => {
      const renderer = root()?.gl;
      return renderer
        ? {
            width: renderer.domElement.width,
            height: renderer.domElement.height,
            dpr: renderer.getPixelRatio(),
          }
        : null;
    };
    const pose = () => {
      const camera = root()?.camera;
      return camera
        ? { position: camera.position.toArray(), quaternion: camera.quaternion.toArray() }
        : null;
    };
    window.__cabaneInteraction = {
      begin(name) {
        if (active) throw new Error("An interaction capture is already active.");
        const start = performance.now();
        const renderer = root().gl;
        const originalRender = renderer.render;
        const record = {
          name,
          startedAtMs: start,
          frames: [],
          renders: [],
          events: [],
          longTasks: [],
          cameraStart: pose(),
          cameraSamples: [],
          canvasStart: canvas(),
          canvasStable: true,
        };
        const observeCanvas = () => {
          const current = canvas(),
            start = record.canvasStart;
          if (
            !current ||
            !start ||
            current.width !== start.width ||
            current.height !== start.height ||
            current.dpr !== start.dpr
          )
            record.canvasStable = false;
          return current;
        };
        let lastFrame;
        let raf;
        const frame = (time) => {
          observeCanvas();
          if (lastFrame !== undefined)
            record.frames.push({ atMs: time - start, intervalMs: time - lastFrame });
          record.cameraSamples.push({ atMs: time - start, ...pose() });
          lastFrame = time;
          raf = requestAnimationFrame(frame);
        };
        const input = (event) => {
          const time = performance.now();
          const sample = {
            type: event.type,
            atMs: time - start,
            trusted: event.isTrusted,
            target: event.target?.tagName ?? null,
            ...(event.type === "keydown" ? { code: event.code } : {}),
          };
          record.events.push(sample);
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              sample.feedbackMs = performance.now() - time;
            }),
          );
        };
        const types = ["pointerdown", "pointerup", "click", "keydown"];
        for (const type of types) document.addEventListener(type, input, true);
        const addLongTasks = (entries) => {
          for (const entry of entries)
            if (entry.startTime >= start)
              record.longTasks.push({ atMs: entry.startTime - start, durationMs: entry.duration });
        };
        const observer = new PerformanceObserver((list) => addLongTasks(list.getEntries()));
        observer.observe({ type: "longtask" });
        renderer.render = function () {
          const main = arguments[0] === root()?.scene;
          if (main) observeCanvas();
          const shadowUpdate = renderer.shadowMap.needsUpdate;
          const before = performance.now();
          try {
            return originalRender.apply(this, arguments);
          } finally {
            record.renders.push({
              atMs: before - start,
              submitMs: performance.now() - before,
              main,
              ...(main
                ? {
                    calls: renderer.info.render.calls,
                    triangles: renderer.info.render.triangles,
                    shadowUpdate,
                  }
                : {}),
            });
          }
        };
        raf = requestAnimationFrame(frame);
        active = {
          finish() {
            cancelAnimationFrame(raf);
            for (const type of types) document.removeEventListener(type, input, true);
            addLongTasks(observer.takeRecords());
            observer.disconnect();
            renderer.render = originalRender;
            record.durationMs = performance.now() - start;
            record.cameraEnd = pose();
            record.canvasEnd = observeCanvas();
            return record;
          },
        };
      },
      end() {
        if (!active) throw new Error("No interaction capture is active.");
        const result = active.finish();
        active = null;
        return result;
      },
    };
  });
}

function summarizeInteraction(record) {
  const intervals = record.frames.map((frame) => frame.intervalMs);
  const feedback = record.events.flatMap((event) => event.feedbackMs ?? []);
  const mainRenders = record.renders.filter((render) => render.main === true);
  const start = record.cameraStart;
  const cameraTravel = start
    ? Math.max(
        0,
        ...record.cameraSamples.map((sample) =>
          Math.hypot(...sample.position.map((value, index) => value - start.position[index])),
        ),
      )
    : 0;
  const cameraTurn = start
    ? Math.max(
        0,
        ...record.cameraSamples.map(
          (sample) =>
            2 *
            Math.acos(
              Math.min(
                1,
                Math.abs(
                  sample.quaternion.reduce(
                    (sum, value, index) => sum + value * start.quaternion[index],
                    0,
                  ),
                ),
              ),
            ),
        ),
      )
    : 0;
  return {
    name: record.name,
    durationMs: record.durationMs,
    frameCount: intervals.length,
    canvasStart: record.canvasStart,
    canvasEnd: record.canvasEnd,
    canvasStable: record.canvasStable,
    fps: intervals.length
      ? (1000 * intervals.length) / intervals.reduce((sum, value) => sum + value, 0)
      : 0,
    frameMsP50: percentile(intervals, 0.5),
    frameMsP95: percentile(intervals, 0.95),
    maxFrameMs: Math.max(0, ...intervals),
    over33MsPercent:
      (100 * intervals.filter((value) => value > 1000 / 30).length) / intervals.length,
    feedbackMsP95: percentile(feedback, 0.95),
    maxFeedbackMs: Math.max(0, ...feedback),
    maxLongTaskMs: Math.max(0, ...record.longTasks.map((task) => task.durationMs)),
    totalLongTaskMs: record.longTasks.reduce((sum, task) => sum + task.durationMs, 0),
    renderCount: record.renders.length,
    ...(mainRenders.length
      ? {
          mainRenderCount: mainRenders.length,
          mainCallsMedian: median(mainRenders.map((render) => render.calls)),
          mainTrianglesMedian: median(mainRenders.map((render) => render.triangles)),
          mainShadowUpdateFraction:
            mainRenders.filter((render) => render.shadowUpdate).length / mainRenders.length,
        }
      : {}),
    cpuSubmitMsP95: percentile(
      record.renders.map((render) => render.submitMs),
      0.95,
    ),
    cameraTravel,
    cameraTurnRadians: cameraTurn,
  };
}

export async function measureInteraction(page, name, action, { settleMs = 900 } = {}) {
  await page.evaluate((name) => window.__cabaneInteraction.begin(name), name);
  try {
    await action();
    // Include deferred renderer preparation/autosave after input completes.
    await page.waitForTimeout(settleMs);
    // A long task can finish immediately before the timer/evaluate response.
    // Observe its trailing frame interval before cancelling the RAF recorder.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  } catch (error) {
    await page.evaluate(() => window.__cabaneInteraction.end());
    throw error;
  }
  const raw = await page.evaluate(() => window.__cabaneInteraction.end());
  assert.ok(
    raw.events.some((event) => event.trusted),
    `${name} must send trusted browser input`,
  );
  assert.ok(raw.renders.length, `${name} must render the actual scene`);
  assert.ok(raw.frames.length >= 2, `${name} must capture at least two complete RAF intervals`);
  assert.ok(raw.canvasStart && raw.canvasEnd, `${name} must record its canvas dimensions`);
  assert.equal(raw.canvasStable, true, `${name} canvas dimensions/DPR changed during capture`);
  assert.deepEqual(
    raw.canvasEnd,
    raw.canvasStart,
    `${name} canvas dimensions/DPR changed during capture`,
  );
  return { ...summarizeInteraction(raw), raw };
}

export async function openDemo(page, origin) {
  await page.goto(`${origin}/tests/performance-harness.html`);
  await page.waitForFunction(
    () =>
      window.__cabanePerf?.ready() ||
      [...document.querySelectorAll("button")].some(
        (button) => button.textContent.trim().startsWith("Explore the demo") && button.offsetWidth,
      ),
  );
  const demo = page.getByRole("button", { name: /^Explore the demo/ });
  if (await demo.isVisible()) await demo.click();
  await page.waitForFunction(() => window.__cabanePerf?.ready());
  await page.evaluate(() => {
    document.querySelector(".perf-panel").hidden = true;
  });
}

export async function openArrange(page) {
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: "Open Arrange", exact: true }).click();
  await page.waitForURL(/\/arrange$/);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.waitForFunction(() => {
    const state = window.__cabanePerf.root();
    return (
      state?.camera.isOrthographicCamera && state.scene.getObjectByName("furnishing-edit-layer")
    );
  });
}

export async function replayArrangeMoveDeselect(
  page,
  { runs = 3, targetItemId = defaultItemId, onResult = () => {} } = {},
) {
  const results = [];
  const record = (result) => {
    results.push(result);
    onResult(result);
  };
  for (let index = 0; index < runs; index++) {
    const point = await page.evaluate(
      (id) => window.__cabanePerf.itemPoint(`furnishing-edit-target-${id}`),
      targetItemId,
    );
    await page.mouse.click(point.x, point.y);
    await selection(page, targetItemId).waitFor({ state: "visible" });
    const box = await page.getByRole("button", { name: "Drag to move", exact: true }).boundingBox();
    assert.ok(box, "Selected item must have its real move handle");
    const readPosition = () =>
      page.evaluate(
        (id) =>
          window.__cabanePerf
            .root()
            .scene.getObjectByName(`furnishing-edit-target-${id}`)
            .position.toArray(),
        targetItemId,
      );
    const before = await readPosition();
    record(
      await measureInteraction(page, `arrange-move-${index + 1}`, async () => {
        const x = box.x + box.width / 2,
          y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + (index % 2 ? -24 : 24), y + 12, { steps: 8 });
        await page.mouse.up();
      }),
    );
    assert.notDeepEqual(await readPosition(), before, "Move replay must change the item placement");
    record(
      await measureInteraction(page, `arrange-deselect-${index + 1}`, async () => {
        // Find an actual canvas background point outside all item picking boxes.
        const point = await page.evaluate(() => {
          const state = window.__cabanePerf.root();
          const canvas = state.gl.domElement;
          const rect = canvas.getBoundingClientRect();
          const targets = state.scene
            .getObjectByName("furnishing-edit-layer")
            .children.filter((child) => child.name.startsWith("furnishing-edit-target-"));
          const raycaster = new state.raycaster.constructor();
          state.scene.updateMatrixWorld(true);
          for (const v of [0.2, 0.4, 0.6, 0.8])
            for (const u of [0.95, 0.8, 0.65, 0.5, 0.35]) {
              const x = rect.x + rect.width * u,
                y = rect.y + rect.height * v;
              if (document.elementFromPoint(x, y) !== canvas) continue;
              raycaster.setFromCamera({ x: 2 * u - 1, y: 1 - 2 * v }, state.camera);
              if (!raycaster.intersectObjects(targets, true).length) return { x, y };
            }
          throw new Error("No unobstructed canvas background point found.");
        });
        await page.mouse.click(point.x, point.y);
        await selection(page, targetItemId).waitFor({ state: "hidden", timeout: 5000 });
      }),
    );
  }
  return results;
}

export async function replayArrangeFloors(page, { runs = 3, onResult = () => {} } = {}) {
  const results = [];
  for (let index = 0; index < runs; index++)
    for (const floor of ["First floor", "Ground floor"]) {
      const button = page
        .locator(".editor-floor-controls")
        .getByRole("button", { name: floor, exact: true });
      await page.locator(".editor-floor-controls .floor-picker").hover();
      const result = await measureInteraction(
        page,
        `arrange-floor-${floor}-${index + 1}`,
        async () => {
          await button.click();
          await page.waitForFunction(
            (floor) =>
              document
                .querySelector(`.editor-floor-controls button[aria-label="${floor}"]`)
                ?.getAttribute("aria-pressed") === "true",
            floor,
          );
        },
      );
      results.push(result);
      onResult(result);
    }
  return results;
}

export async function replayWalk(page, { runs = 3, walkHoldMs = 450, onResult = () => {} } = {}) {
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".editor-header"));
  await page.getByRole("button", { name: "Walk mode", exact: true }).click();
  await page.locator(".cabane-shell.mode-walk").waitFor();
  await page.waitForFunction(() => document.pointerLockElement !== null && document.hasFocus());
  await page.waitForFunction(() => window.__cabanePerf.root()?.camera.isPerspectiveCamera);
  const results = [];
  for (let index = 0; index < runs; index++) {
    const result = await measureInteraction(
      page,
      `walk-input-${index + 1}`,
      async () => {
        for (const [step, key] of ["w", "d", "s", "a"].entries()) {
          await page.keyboard.down(key);
          await page.mouse.move(720 + step * 12, 480 + step * 4, { steps: 4 });
          await page.waitForTimeout(walkHoldMs);
          await page.keyboard.up(key);
        }
      },
      { settleMs: 300 },
    );
    assert.ok(
      await page.evaluate(
        () =>
          document.pointerLockElement !== null &&
          document.visibilityState === "visible" &&
          document.hasFocus(),
      ),
      "Walk replay must retain pointer lock and browser focus",
    );
    assert.ok(
      result.cameraTravel > 0.1,
      "Walk replay must move the real camera using keyboard input",
    );
    assert.ok(result.cameraTurnRadians > 0.005, "Walk replay must turn using real mouse input");
    results.push(result);
    onResult(result);
  }
  await page.keyboard.press("Escape");
  return results;
}
