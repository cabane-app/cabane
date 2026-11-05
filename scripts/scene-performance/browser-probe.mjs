// Serialized by Playwright: keep this function self-contained. This is a dev-only
// probe of R3F's live root, not instrumentation shipped in the application.
export async function measureScene({
  selector,
  moduleUrl,
  preparationModuleUrl,
  motion = false,
  samples,
  warmupFrames = 8,
}) {
  if (!moduleUrl) throw new Error("Cannot locate the application's Vite R3F module.");
  const { _roots, addEffect, addAfterEffect } = await import(moduleUrl);
  const canvas = document.querySelector(selector);
  let root;
  for (let attempt = 0; attempt < 200; attempt++) {
    root = _roots.get(canvas);
    if (root?.store.getState().internal.active) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!root?.store.getState().internal.active) throw new Error("Scene root is not ready.");
  const state = root.store.getState();
  if (preparationModuleUrl) {
    // A mode switch can mount geometry before its first frame registers LOD work.
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        remove();
        reject(new Error("First scene frame timed out."));
      }, 120_000);
      const remove = addAfterEffect(() => {
        remove();
        clearTimeout(timeout);
        resolve();
      });
      state.invalidate();
    });
    const { waitForScenePreparation } = await import(preparationModuleUrl);
    let timeout;
    try {
      await Promise.race([
        waitForScenePreparation(state.scene),
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Scene preparation timed out after 120 seconds.")),
            120_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
      state.invalidate();
    }
  }
  const { gl } = state;
  const originalAutoReset = gl.info.autoReset;
  const originalRender = gl.render;
  const originalDirect = gl.renderBufferDirect;
  const empty = () => ({ calls: 0, triangles: 0, lines: 0, points: 0 });
  let outerCamera, outerScene, contributions, passes;
  let remainingWarmup = warmupFrames;
  const frames = [];
  let shadowRefresh;
  let before, after, timer, move;
  const initialPosition = motion ? state.camera.position.clone() : null;
  const initialZoom = state.camera.zoom;
  const initialQuaternion = motion ? state.camera.quaternion.clone() : null;
  const seenBuffers = new Set();
  let frameStart = 0,
    lastFrame = 0,
    newBuffers = 0,
    motionIndex = 0;
  if (motion)
    move = state.internal.subscribe(
      {
        current: () => {
          // After camera controls (priority 0), before StylizedScene (priority 1).
          const t = motionIndex++ / Math.max(1, samples - 1);
          const camera = root.store.getState().camera;
          camera.position.copy(initialPosition);
          camera.quaternion.copy(initialQuaternion);
          if (camera.isOrthographicCamera) {
            const angle = Math.sin(t * Math.PI * 2) * 0.6;
            const x = camera.position.x,
              z = camera.position.z;
            camera.position.x = x * Math.cos(angle) + z * Math.sin(angle);
            camera.position.z = z * Math.cos(angle) - x * Math.sin(angle);
            camera.zoom = initialZoom * (1 + 0.5 * Math.sin(t * Math.PI * 2));
            camera.updateProjectionMatrix();
            camera.lookAt(0, 0, 0);
          } else {
            camera.rotateY(Math.sin(t * Math.PI * 2) * 0.8);
            camera.position.x += Math.sin(t * Math.PI * 2) * 0.4;
          }
          camera.updateMatrixWorld();
        },
      },
      0.5,
      root.store,
    );
  gl.info.autoReset = false;
  gl.render = function (scene, camera) {
    outerCamera = camera;
    outerScene = scene;
    if (motion && scene === state.scene)
      for (const object of scene.children) {
        if (object.isBatchedMesh && !seenBuffers.has(object.geometry.uuid)) {
          seenBuffers.add(object.geometry.uuid);
          newBuffers++;
        }
      }
    return originalRender.apply(this, arguments);
  };
  gl.renderBufferDirect = function (camera, scene, geometry, material, object) {
    const start = { ...gl.info.render };
    originalDirect.apply(this, arguments);
    if (!contributions) return;
    const pass =
      camera !== outerCamera ? "shadow" : outerScene === state.scene ? "scene" : "postprocessing";
    // Stable authored names, rather than runtime UUIDs, make reports comparable.
    const names = [];
    for (let node = object; node; node = node.parent) if (node.name) names.unshift(node.name);
    const item = names.findIndex(
      (name) => name.startsWith("scene-item-") || name.startsWith("furnishing-edit-target-"),
    );
    const path = (item >= 0 ? names.slice(0, item + 1) : names).join("/") || geometry.type;
    const key = `${pass}:${path}`;
    const contribution = (contributions[key] ??= { pass, path, ...empty() });
    const total = (passes[pass] ??= empty());
    for (const metric of Object.keys(total)) {
      const delta = gl.info.render[metric] - start[metric];
      total[metric] += delta;
      contribution[metric] += delta;
    }
  };
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error("Scene sampling timed out after 120 seconds.")),
        120_000,
      );
      // Global hooks leave R3F's render ownership intact. The selected renderer's
      // counters exclude catalog thumbnails and other canvases.
      before = addEffect(() => {
        frameStart = performance.now();
        newBuffers = 0;
        gl.info.reset();
        contributions = {};
        passes = {};
        if (!remainingWarmup && frames.length === samples && gl.shadowMap.enabled)
          gl.shadowMap.needsUpdate = true;
      });
      after = addAfterEffect(() => {
        if (gl.info.render.calls > 0) {
          const frame = { ...empty(), passes, contributions: Object.values(contributions) };
          for (const metric of Object.keys(empty())) frame[metric] = gl.info.render[metric];
          if (motion) {
            frame.cpuMs = performance.now() - frameStart;
            frame.frameIntervalMs = lastFrame ? frameStart - lastFrame : 0;
            frame.batchBuffersCreated = newBuffers;
            frame.cameraPosition = root.store.getState().camera.position.toArray();
            lastFrame = frameStart;
          }
          if (remainingWarmup) remainingWarmup--;
          else if (frames.length < samples) frames.push(frame);
          else {
            shadowRefresh = frame;
            resolve();
            return;
          }
        }
        // R3F decides whether to stop its global loop after after-effects. An
        // invalidation inside that callback can be lost on a demand canvas.
        queueMicrotask(() => state.invalidate());
      });
      state.invalidate();
    });
    for (const frame of [...frames, shadowRefresh]) {
      for (const metric of Object.keys(empty())) {
        const attributed = Object.values(frame.passes).reduce((sum, pass) => sum + pass[metric], 0);
        if (attributed !== frame[metric])
          throw new Error(
            `Unattributed ${metric}: frame=${frame[metric]}, passes=${attributed}. Update the renderer probe.`,
          );
      }
    }
    const current = root.store.getState();
    const materials = new Set();
    let meshes = 0,
      instancedMeshes = 0,
      geometryTriangles = 0;
    current.scene.traverseVisible((object) => {
      if (!object.isMesh) return;
      meshes++;
      if (object.isInstancedMesh) instancedMeshes++;
      geometryTriangles +=
        ((object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0) / 3) *
        (object.isInstancedMesh ? object.count : 1);
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material.uuid);
    });
    const percentiles = (values) => {
      values.sort((a, b) => a - b);
      return {
        p50: values[Math.floor((values.length - 1) * 0.5)],
        p95: values[Math.floor((values.length - 1) * 0.95)],
        max: values.at(-1),
      };
    };
    return {
      ...(motion
        ? {
            motion: {
              cpuMs: percentiles(frames.map((frame) => frame.cpuMs)),
              frameIntervalMs: percentiles(frames.map((frame) => frame.frameIntervalMs)),
              batchBuffersCreated: frames.reduce(
                (sum, frame) => sum + frame.batchBuffersCreated,
                0,
              ),
              note: "Host RAF timings include instrumentation and software-renderer blocking; not mobile FPS.",
            },
          }
        : {}),
      camera: {
        type: current.camera.type,
        position: current.camera.position.toArray(),
        quaternion: current.camera.quaternion.toArray(),
        projectionMatrix: current.camera.projectionMatrix.toArray(),
      },
      canvas: { width: canvas.width, height: canvas.height, dpr: gl.getPixelRatio() },
      shadowsEnabled: gl.shadowMap.enabled,
      inventory: {
        visibleHierarchyMeshes: meshes,
        instancedMeshes,
        materialObjects: materials.size,
        geometryTriangles,
      },
      frames,
      shadowRefresh,
    };
  } finally {
    clearTimeout(timer);
    before?.();
    after?.();
    move?.();
    if (motion) {
      state.camera.position.copy(initialPosition);
      state.camera.quaternion.copy(initialQuaternion);
      state.camera.zoom = initialZoom;
      state.camera.updateProjectionMatrix();
      state.camera.updateMatrixWorld();
      state.invalidate();
    }
    gl.render = originalRender;
    gl.renderBufferDirect = originalDirect;
    gl.info.autoReset = originalAutoReset;
  }
}
