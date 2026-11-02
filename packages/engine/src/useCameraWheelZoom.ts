import { useThree } from "@react-three/fiber";
import { useEffect, type RefObject } from "react";
import { Vector3, type OrthographicCamera } from "three";
import type { OrbitControls } from "three-stdlib";

/** Distance-based wheel zoom; drag and touch gestures remain with MapControls. */
export function useCameraWheelZoom(controls: RefObject<OrbitControls | null>, enabled = true) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    if (!enabled) return;
    const before = new Vector3();
    const after = new Vector3();
    const onWheel = (event: WheelEvent) => {
      const active = controls.current;
      const camera = active?.object as OrthographicCamera | undefined;
      if (!active?.enabled || !active.enableZoom || !camera?.isOrthographicCamera) return;
      event.preventDefault();
      // three-stdlib's wheel handler uses only the sign of deltaY. Capture it
      // first so tiny trackpad events and coarse mouse steps retain their size.
      event.stopImmediatePropagation();
      if (event.deltaY === 0) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      active.dispatchEvent({ type: "start", target: active });
      camera.updateMatrixWorld();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = 1 - ((event.clientY - rect.top) / rect.height) * 2;
      before.set(x, y, 0).unproject(camera);
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      const sensitivity = event.ctrlKey || event.metaKey ? 0.01 : 0.0015;
      camera.zoom = Math.max(
        active.minZoom,
        Math.min(
          active.maxZoom,
          camera.zoom * Math.exp(-event.deltaY * unit * sensitivity * active.zoomSpeed),
        ),
      );
      camera.updateProjectionMatrix();
      if (active.zoomToCursor) {
        after.set(x, y, 0).unproject(camera);
        before.sub(after);
        if (!active.screenSpacePanning) {
          // Keep the orbit pivot on its navigation plane as the camera moves.
          camera.getWorldDirection(after);
          const vertical = after.dot(camera.up);
          if (Math.abs(vertical) > 1e-6)
            before.addScaledVector(after, -before.dot(camera.up) / vertical);
        }
        // Translate camera and pivot together. Moving only the pivot onto its
        // plane changes the orbit radius and can push the camera through it.
        camera.position.add(before);
        active.target.add(before);
        camera.updateMatrixWorld();
      }
      active.dispatchEvent({ type: "change", target: active });
      active.dispatchEvent({ type: "end", target: active });
    };
    canvas.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => canvas.removeEventListener("wheel", onWheel, true);
  }, [canvas, controls, enabled]);
}
