// Loaded only by the opt-in development runner, through its Vite instance.
import { _roots, addAfterEffect } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Box3 } from "three";
import { waitForSceneGeometryLods } from "@cabane/engine";
import { cameraPose, frameCamera, restoreCameraPose } from "./dev-agent-camera.mjs";

export async function captureScene({ operation, target, view, padding, pose, timeoutMs }) {
  const deadline = performance.now() + timeoutMs;
  const canvas = document.querySelector(".direction-preview__model canvas");
  if (!canvas) throw new Error("The home editor canvas is not open.");
  const root = _roots.get(canvas);
  if (!root) throw new Error("The editor scene has not mounted.");
  const state = root.store.getState();
  const { gl } = state;
  if (gl.getContext().isContextLost()) throw new Error("The editor WebGL context was lost.");
  const renderedFrame = (pixels = false) =>
    new Promise((resolve, reject) => {
      const initialFrame = gl.info.render.frame;
      const timer = setTimeout(
        () => {
          remove();
          reject(new Error("Timed out waiting for the editor to render."));
        },
        Math.max(1, deadline - performance.now()),
      );
      const remove = addAfterEffect(() => {
        if (gl.info.render.frame > initialFrame && !useProgress.getState().active) {
          remove();
          clearTimeout(timer);
          try {
            if (!pixels) return resolve();
            const output = document.createElement("canvas");
            output.width = canvas.width;
            output.height = canvas.height;
            const context = output.getContext("2d");
            const editor = canvas.closest(".direction-preview");
            if (editor) {
              context.fillStyle = getComputedStyle(editor).backgroundColor;
              context.fillRect(0, 0, output.width, output.height);
            }
            context.drawImage(canvas, 0, 0);
            resolve(output.toDataURL("image/png"));
          } catch (error) {
            reject(error);
          }
        } else queueMicrotask(() => state.invalidate());
      });
      state.invalidate();
    });
  await renderedFrame();
  // A mode/floor switch can replace the camera during its first scene commit.
  let { camera, controls } = root.store.getState();
  while (
    !camera.isOrthographicCamera ||
    controls?.object !== camera ||
    controls.enableRotate === false
  ) {
    await renderedFrame();
    ({ camera, controls } = root.store.getState());
  }
  if (operation === "restore") {
    restoreCameraPose(camera, controls, pose);
    await renderedFrame();
    return;
  }
  const geometryReady = async () => {
    let timer;
    try {
      await Promise.race([
        waitForSceneGeometryLods(state.scene),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Timed out preparing scene geometry.")),
            Math.max(1, deadline - performance.now()),
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  await geometryReady();
  if (useProgress.getState().errors.length)
    throw new Error(`Scene assets failed to load: ${useProgress.getState().errors.join(", ")}`);
  if (operation === "read") return cameraPose(camera, controls);
  state.scene.updateMatrixWorld(true);
  const object = state.scene.getObjectByName(target);
  if (!object)
    throw new Error(`Rendered target ${target} was not found. Inspect its floor and ID.`);
  for (let parent = object; parent; parent = parent.parent)
    if (!parent.visible) throw new Error(`Rendered target ${target} is hidden.`);
  const bounds = new Box3().setFromObject(object, true);
  const framed = frameCamera(camera, controls, bounds, view, padding);
  // The normal camera-change callback saves this pose and invalidates the scene.
  // Two completed main-canvas frames allow camera-dependent cutaways/batches to update.
  await renderedFrame();
  await geometryReady();
  const png = await renderedFrame(operation === "capture");
  return {
    view,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    camera: framed,
    ...(png ? { png, width: canvas.width, height: canvas.height } : {}),
  };
}
