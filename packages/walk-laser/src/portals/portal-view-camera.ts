import {
  Frustum,
  Matrix4,
  PerspectiveCamera,
  Plane,
  Sphere,
  Vector3,
  Vector4,
  type Camera,
} from "three";
import type { PortalAnchor } from "./portal-contract";

/** A rigid doorway transform, followed by an exit-plane near clip. No scene mutation. */
export function createPortalViewCamera() {
  const camera = new PerspectiveCamera();
  const entryMatrix = new Matrix4(),
    exitMatrix = new Matrix4(),
    transfer = new Matrix4();
  const turn = new Matrix4().makeRotationY(Math.PI);
  const scale = new Vector3(1, 1, 1),
    eye = new Vector3(),
    offset = new Vector3();
  const frustum = new Frustum(),
    projectionView = new Matrix4(),
    crop = new Matrix4();
  const bounds = new Sphere();
  const screenRect = new Vector4(0, 0, 1, 1);
  const plane = new Plane(),
    clip = new Vector4(),
    corner = new Vector4();

  function fitAperture(aperture: Matrix4) {
    let left = 1,
      bottom = 1,
      right = 0,
      top = 0;
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        clip.set(x, y, 0, 1).applyMatrix4(aperture).applyMatrix4(projectionView);
        // Corners across the viewer's near plane cannot bound the projected oval.
        if (clip.w <= 0 || clip.z <= -clip.w) {
          screenRect.set(0, 0, 1, 1);
          return true;
        }
        const u = (clip.x / clip.w + 1) / 2,
          v = (clip.y / clip.w + 1) / 2;
        left = Math.min(left, u);
        bottom = Math.min(bottom, v);
        right = Math.max(right, u);
        top = Math.max(top, v);
      }
    }
    left = Math.max(0, left);
    bottom = Math.max(0, bottom);
    const width = Math.min(1, right) - left,
      height = Math.min(1, top) - bottom;
    if (width <= 1e-6 || height <= 1e-6) return false;
    screenRect.set(left, bottom, width, height);
    return true;
  }

  return {
    camera,
    screenRect,
    update(viewer: Camera, entry: PortalAnchor, exit: PortalAnchor, aperture: Matrix4): boolean {
      if (!(viewer as PerspectiveCamera).isPerspectiveCamera) return false;
      viewer.updateWorldMatrix(true, false);
      eye.setFromMatrixPosition(viewer.matrixWorld);
      if (offset.subVectors(eye, entry.center).dot(entry.normal) <= 0.01) return false;
      projectionView.multiplyMatrices(viewer.projectionMatrix, viewer.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projectionView);
      bounds.center.setFromMatrixPosition(aperture);
      bounds.radius = aperture.getMaxScaleOnAxis();
      if (!frustum.intersectsSphere(bounds) || !fitAperture(aperture)) return false;

      entryMatrix.compose(entry.center, entry.rotation, scale);
      exitMatrix.compose(exit.center, exit.rotation, scale);
      transfer
        .copy(exitMatrix)
        .multiply(turn)
        .multiply(entryMatrix.invert())
        .multiply(viewer.matrixWorld);
      transfer.decompose(camera.position, camera.quaternion, scale);
      scale.set(1, 1, 1);
      camera.near = (viewer as PerspectiveCamera).near;
      camera.far = (viewer as PerspectiveCamera).far;
      camera.layers.mask = viewer.layers.mask;
      camera.updateMatrixWorld(true);
      camera.projectionMatrix.copy(viewer.projectionMatrix);

      // Clip everything behind the exit, including the wall containing it. An
      // oblique near plane also handles floor/wall pairs and oblique viewing.
      plane
        .setFromNormalAndCoplanarPoint(exit.normal, exit.center)
        .applyMatrix4(camera.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const p = camera.projectionMatrix.elements;
      corner.set(
        (Math.sign(clip.x) + p[8]) / p[0],
        (Math.sign(clip.y) + p[9]) / p[5],
        -1,
        (1 + p[10]) / p[14],
      );
      const denominator = clip.dot(corner);
      if (denominator <= 1e-6) return false;
      clip.multiplyScalar(2 / denominator);
      p[2] = clip.x;
      p[6] = clip.y;
      p[10] = clip.z + 1;
      p[14] = clip.w;
      // Tighten X/Y after oblique clipping, leaving the exit plane at the same depth.
      const { x: left, y: bottom, z: width, w: height } = screenRect;
      crop.set(
        1 / width,
        0,
        0,
        (1 - 2 * left) / width - 1,
        0,
        1 / height,
        0,
        (1 - 2 * bottom) / height - 1,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
      );
      camera.projectionMatrix.premultiply(crop);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      return true;
    },
  };
}
