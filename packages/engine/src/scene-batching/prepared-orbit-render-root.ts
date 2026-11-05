import type { Object3D } from "three";

const revisions = new WeakMap<Object3D, number>();

/** A marked subtree owns immutable shadow inputs between authored revisions. */
export function preparedOrbitShadowRevision(root: Object3D) {
  return revisions.get(root);
}

export function markPreparedOrbitRenderRoot(root: Object3D, revision: number) {
  revisions.set(root, revision);
}
