import { createRoot } from "react-dom/client";
import { Canvas, useFrame } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";

function Ready() {
  useFrame(({ camera, controls }) => {
    if (camera.type === "OrthographicCamera" && controls)
      document.documentElement.dataset.captureReady = "true";
  });
  return null;
}

export function mountCaptureHarness() {
  document.body.innerHTML =
    '<div class="direction-preview__model" style="width:640px;height:400px"></div>';
  const container = document.querySelector(".direction-preview__model")!;
  const root = createRoot(container);
  root.render(
    <Canvas orthographic frameloop="demand" camera={{ position: [5, 4, 5], zoom: 50 }}>
      <color attach="background" args={["#123456"]} />
      <MapControls makeDefault target={[0, 0.5, 0]} />
      <Ready />
      <mesh name="capture-target" position={[0, 0.5, 0]}>
        <boxGeometry args={[2, 1, 1]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
    </Canvas>,
  );
  return () => root.unmount();
}
