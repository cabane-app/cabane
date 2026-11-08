import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Mesh } from "three";
import type { PortalAnchor } from "./portal-contract";
import { createPortalViewCamera } from "./portal-view-camera";
import { createPortalViewRenderer } from "./portal-view-renderer";

/** Captures after camera/motion updates, before the host's main scene pass. */
export function usePortalView(entry: PortalAnchor, exit: PortalAnchor) {
  const surface = useRef<Mesh>(null);
  const view = useMemo(createPortalViewCamera, []);
  const capture = useMemo(createPortalViewRenderer, []);
  useEffect(() => () => capture.dispose(), [capture]);
  useFrame(({ camera, scene, gl }) => {
    if (!surface.current) return;
    surface.current.visible = false;
    if (!view.update(camera, entry, exit)) return;
    capture.render(gl, scene, view.camera, exit);
    surface.current.visible = true;
  }, 0.5);
  return { surface, texture: capture.target.texture };
}
