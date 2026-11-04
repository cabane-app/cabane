import { Vector3 } from "three";

export const CAPTURE_VIEWS = {
  front: [0, 25],
  "front-right": [45, 30],
  right: [90, 25],
  "back-right": [135, 30],
  back: [180, 25],
  "back-left": [225, 30],
  left: [270, 25],
  "front-left": [315, 30],
  top: [0, 90],
  "low-front": [0, 8],
};

export function captureOptions(input = {}, multiple = false) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Camera options must be an object.");
  const options = { padding: 1.2, timeoutMs: 30_000, ...input };
  for (const key of ["itemId", "objectName", "floorId", "directory"])
    if (options[key] !== undefined && (typeof options[key] !== "string" || !options[key].trim()))
      throw new Error(`${key} must be a nonempty string.`);
  if (options.itemId && options.objectName)
    throw new Error("Choose itemId or objectName as the framing target.");
  if (!Number.isFinite(options.padding) || options.padding < 1.05 || options.padding > 3)
    throw new Error("padding must be between 1.05 and 3.");
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000 || options.timeoutMs > 60_000)
    throw new Error("timeoutMs must be between 1000 and 60000.");
  if (options.restore !== undefined && typeof options.restore !== "boolean")
    throw new Error("restore must be a boolean.");
  const views = multiple
    ? (options.views ?? ["front-right", "back-left", "top", "low-front"])
    : [options.view ?? "front-right"];
  if (!Array.isArray(views) || !views.length || views.length > 12)
    throw new Error("Choose between 1 and 12 capture views.");
  options.views = views.map((view) => {
    if (typeof view === "string") {
      const angles = Object.hasOwn(CAPTURE_VIEWS, view) ? CAPTURE_VIEWS[view] : null;
      if (!angles)
        throw new Error(`Unknown view ${view}. Use ${Object.keys(CAPTURE_VIEWS).join(", ")}.`);
      return { name: view, azimuth: angles[0], elevation: angles[1] };
    }
    if (
      !view ||
      typeof view !== "object" ||
      typeof view.name !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(view.name) ||
      !Number.isFinite(view.azimuth) ||
      !Number.isFinite(view.elevation) ||
      view.elevation < 0 ||
      view.elevation > 90
    )
      throw new Error(
        "Custom views need a safe name, finite azimuth and elevation between 0 and 90 degrees.",
      );
    return { name: view.name, azimuth: view.azimuth, elevation: view.elevation };
  });
  if (new Set(options.views.map((view) => view.name.toLowerCase())).size !== options.views.length)
    throw new Error("Capture view names must be unique.");
  return options;
}

export function cameraPose(camera, controls) {
  return {
    position: camera.position.toArray(),
    target: controls.target.toArray(),
    zoom: camera.zoom,
    near: camera.near,
    far: camera.far,
    limits: {
      minZoom: controls.minZoom,
      maxZoom: controls.maxZoom,
      minPolarAngle: controls.minPolarAngle,
      maxPolarAngle: controls.maxPolarAngle,
      enableDamping: controls.enableDamping,
    },
  };
}

export function restoreCameraPose(camera, controls, pose) {
  controls.enableDamping = false;
  controls.update();
  Object.assign(controls, pose.limits, { enableDamping: false });
  controls.target.fromArray(pose.target);
  camera.position.fromArray(pose.position);
  Object.assign(camera, { zoom: pose.zoom, near: pose.near, far: pose.far });
  camera.updateProjectionMatrix();
  controls.update();
  camera.updateMatrixWorld();
  controls.enableDamping = pose.limits.enableDamping;
}

export function frameCamera(camera, controls, bounds, view, padding = 1.2) {
  if (!camera.isOrthographicCamera)
    throw new Error("Framing requires the editor's orthographic camera.");
  if (bounds.isEmpty() || bounds.getSize(new Vector3()).length() < 0.00001)
    throw new Error("The target has no rendered geometry to frame.");
  controls.enableDamping = false;
  controls.update();
  const center = bounds.getCenter(new Vector3());
  const distance = Math.max(2, bounds.getSize(new Vector3()).length() * 3);
  const azimuth = ((view.azimuth % 360) * Math.PI) / 180;
  const elevation = (Math.max(0.001, Math.min(89.999, view.elevation)) * Math.PI) / 180;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  controls.minZoom = 0.0001;
  controls.maxZoom = Number.MAX_SAFE_INTEGER;
  controls.target.copy(center);
  camera.position.set(
    center.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
    center.y + Math.sin(elevation) * distance,
    center.z + Math.cos(azimuth) * Math.cos(elevation) * distance,
  );
  camera.zoom = 1;
  camera.near = 0.01;
  camera.far = Math.max(150, distance * 2);
  controls.update();
  camera.updateMatrixWorld();
  const projected = bounds.clone().applyMatrix4(camera.matrixWorldInverse);
  const size = projected.getSize(new Vector3());
  camera.zoom = Math.min(
    (camera.right - camera.left) / Math.max(size.x * padding, 0.00001),
    (camera.top - camera.bottom) / Math.max(size.y * padding, 0.00001),
  );
  camera.updateProjectionMatrix();
  controls.update();
  return cameraPose(camera, controls);
}
