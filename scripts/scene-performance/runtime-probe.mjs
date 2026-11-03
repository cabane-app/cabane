// Benchmark-only instrumentation. The application bundle never imports this module.
// Keep draw attribution in browser-probe.mjs: per-mesh bookkeeping distorts timings.
export async function captureRuntime({
  root,
  addAfterEffect,
  seconds,
  warmupSeconds = 3,
  driveInput,
  isValid = () => true,
}) {
  const state = root.store.getState();
  const { gl, camera, controls } = state;
  if (!camera.isOrthographicCamera || !controls?.target || !state.internal.priority)
    throw new Error("Open the benchmark home's Orbit view before running the benchmark.");
  if (document.visibilityState !== "visible") throw new Error("Keep the benchmark tab visible.");
  const initial = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    zoom: camera.zoom,
    controlsEnabled: controls.enabled,
    enableDamping: controls.enableDamping,
  };
  const target = controls.target.clone();
  const offset = initial.position.clone().sub(target);
  const original = { render: gl.render, autoReset: gl.info.autoReset };
  const canvas = () => ({
    width: gl.domElement.width,
    height: gl.domElement.height,
    dpr: gl.getPixelRatio(),
  });
  const resolution = canvas();
  const result = { frameIntervalsMs: [], cpuSubmitMs: [], calls: [], triangles: [] };
  let cameraTravel = 0;
  let removeBefore, removeMove, removeAfter, timer;
  let frameStart = 0,
    submitMs = 0,
    started = 0,
    lastFrame = 0,
    sampling = false;
  let rendered = false,
    rejectCapture;
  const fail = (message) => rejectCapture?.(new Error(message));
  const hidden = () => {
    if (document.visibilityState !== "visible") fail("Tab was hidden. Discard this run and retry.");
  };
  const lost = () => fail("WebGL context was lost. Discard this run and retry.");
  controls.enabled = driveInput ? initial.controlsEnabled : false;
  gl.info.autoReset = false;
  gl.render = function () {
    const start = performance.now();
    try {
      return original.render.apply(this, arguments);
    } finally {
      submitMs += performance.now() - start;
      rendered = true;
    }
  };
  document.addEventListener("visibilitychange", hidden);
  gl.domElement.addEventListener("webglcontextlost", lost);
  try {
    const capture = new Promise((resolve, reject) => {
      rejectCapture = reject;
      timer = setTimeout(
        () => fail("Benchmark timed out waiting for rendered frames."),
        (warmupSeconds + seconds) * 1000 + 30_000,
      );
      // Negative priority observes only this canvas without taking render ownership.
      removeBefore = state.internal.subscribe(
        {
          current: () => {
            frameStart = performance.now();
            if (!started) started = frameStart;
            if (!sampling && frameStart - started >= warmupSeconds * 1000) {
              sampling = true;
              started = frameStart;
            }
            submitMs = 0;
            rendered = false;
            gl.info.reset();
          },
        },
        -1000,
        root.store,
      );
      // StylizedScene already owns priority 1. Move after controls, before LOD,
      // culling, shadows and postprocessing all see the same camera.
      if (!driveInput)
        removeMove = state.internal.subscribe(
          {
            current: () => {
              const t = (frameStart - started) / (seconds * 1000);
              const angle = Math.sin(t * Math.PI * 2) * 0.6;
              camera.position.set(
                target.x + offset.x * Math.cos(angle) + offset.z * Math.sin(angle),
                initial.position.y,
                target.z + offset.z * Math.cos(angle) - offset.x * Math.sin(angle),
              );
              camera.zoom = initial.zoom * (1 + 0.5 * Math.sin(t * Math.PI * 2));
              camera.lookAt(target);
              camera.updateProjectionMatrix();
              camera.updateMatrixWorld();
            },
          },
          0.5,
          root.store,
        );
      removeAfter = addAfterEffect(() => {
        if (!rendered) return;
        rendered = false;
        const current = root.store.getState();
        cameraTravel = Math.max(cameraTravel, camera.position.distanceTo(initial.position));
        if (!isValid() || current.camera !== camera || current.controls !== controls)
          return fail("View changed during the benchmark. Discard this run and retry.");
        if (JSON.stringify(canvas()) !== JSON.stringify(resolution))
          return fail("Canvas size/DPR changed. Keep the same orientation and retry.");
        if (sampling) {
          if (lastFrame) {
            result.frameIntervalsMs.push(frameStart - lastFrame);
            result.cpuSubmitMs.push(submitMs);
            result.calls.push(gl.info.render.calls);
            result.triangles.push(gl.info.render.triangles);
          }
          lastFrame = frameStart;
          if (frameStart - started >= seconds * 1000) {
            result.durationMs = frameStart - started;
            resolve();
            return;
          }
        }
        // Demand invalidation must run after R3F decides whether to stop its loop.
        queueMicrotask(() => state.invalidate());
      });
      state.invalidate();
    });
    await Promise.all([capture, driveInput?.({ seconds: warmupSeconds + seconds })]);
    if (driveInput && cameraTravel < 0.1)
      throw new Error("Touch replay did not move the camera. Discard this run.");
    result.cameraTravel = cameraTravel;
    return result;
  } finally {
    clearTimeout(timer);
    removeBefore?.();
    removeMove?.();
    removeAfter?.();
    document.removeEventListener("visibilitychange", hidden);
    gl.domElement.removeEventListener("webglcontextlost", lost);
    gl.render = original.render;
    gl.info.autoReset = original.autoReset;
    // Clear OrbitControls' pending pan/rotation deltas before restoring its pose.
    // Otherwise repeated input runs start from a drifting target.
    if (driveInput && controls.update) {
      controls.enableDamping = false;
      controls.update();
    }
    controls.target.copy(target);
    controls.enabled = initial.controlsEnabled;
    camera.position.copy(initial.position);
    camera.quaternion.copy(initial.quaternion);
    camera.zoom = initial.zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if (driveInput) controls.update?.();
    controls.enableDamping = initial.enableDamping;
    state.invalidate();
  }
}
