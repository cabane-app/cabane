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
import { PORTAL_HEIGHT, type PortalAnchor } from "./portal-contract";

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
    projectionView = new Matrix4();
  const bounds = new Sphere(new Vector3(), PORTAL_HEIGHT * 1.15);
  const plane = new Plane(),
    clip = new Vector4(),
    corner = new Vector4();

  return {
    camera,
    update(viewer: Camera, entry: PortalAnchor, exit: PortalAnchor): boolean {
      if (!(viewer as PerspectiveCamera).isPerspectiveCamera) return false;
      viewer.updateWorldMatrix(true, false);
      eye.setFromMatrixPosition(viewer.matrixWorld);
      if (offset.subVectors(eye, entry.center).dot(entry.normal) <= 0.01) return false;
      projectionView.multiplyMatrices(viewer.projectionMatrix, viewer.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projectionView);
      bounds.center.copy(entry.center);
      if (!frustum.intersectsSphere(bounds)) return false;

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
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      return true;
    },
  };
}
