import { Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { ShaderMaterial } from "three";
import { noPlanRaycast } from "../construct/PlanDrawing";
import type { SelectionBoxGeometry } from "./editor-state";
import {
  compileSelectionEdge,
  compileSelectionGlow,
  selectionScanFragmentShader,
  selectionScanVertexShader,
} from "./selection-hologram-material";

/** Screen-space strokes keep selection legible at every camera distance. */
export function SelectionBounds({ center, size }: SelectionBoxGeometry) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const scan = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { phase: { value: 0 }, enabled: { value: 0 } },
        vertexShader: selectionScanVertexShader,
        fragmentShader: selectionScanFragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => scan.dispose(), [scan]);
  const [width, height, depth] = size;
  const { edges, paddedSize } = useMemo(() => {
    const half = [width, height, depth].map((value) => value / 2 + 0.035);
    const edges: [number, number, number][] = [];
    for (const x of [-1, 1])
      for (const y of [-1, 1])
        for (const z of [-1, 1]) {
          const corner: [number, number, number] = [x * half[0], y * half[1], z * half[2]];
          for (let axis = 0; axis < 3; axis++) {
            const end: [number, number, number] = [...corner];
            if (corner[axis] < 0) {
              end[axis] *= -1;
              edges.push(corner, end);
            }
          }
        }
    return {
      edges,
      paddedSize: half.map((value) => value * 2) as [number, number, number],
    };
  }, [width, height, depth]);
  useEffect(() => {
    const document = gl.domElement.ownerDocument;
    const host = document?.defaultView;
    if (!host) return;
    const uniforms = scan.uniforms;
    const motion = host.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const update = () => {
      host.clearInterval(timer);
      uniforms.enabled.value = !motion.matches && !document.hidden ? 1 : 0;
      if (uniforms.enabled.value) {
        const start = host.performance.now();
        // A selected item needs only a slow scan, not a full-rate render loop.
        timer = host.setInterval(() => {
          uniforms.phase.value = ((host.performance.now() - start) / 6000) % 1;
          invalidate();
        }, 1000 / 24);
      }
      invalidate();
    };
    update();
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      host.clearInterval(timer);
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [gl, invalidate, scan]);
  const overlay = {
    segments: true,
    raycast: noPlanRaycast,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    transparent: true,
  } as const;
  return (
    <group name="arrange-selection-bounds" position={center}>
      <mesh raycast={noPlanRaycast} scale={paddedSize} renderOrder={30}>
        <boxGeometry />
        <primitive object={scan} attach="material" />
      </mesh>
      <Line
        {...overlay}
        points={edges}
        color="#00f5ff"
        lineWidth={18}
        opacity={0.82}
        onBeforeCompile={compileSelectionGlow}
        customProgramCacheKey={() => "selection-glow-v1"}
        renderOrder={31}
      />
      <Line
        {...overlay}
        points={edges}
        color="#baffff"
        lineWidth={1.75}
        opacity={0.96}
        onBeforeCompile={compileSelectionEdge}
        customProgramCacheKey={() => "selection-edge-v1"}
        renderOrder={32}
      />
    </group>
  );
}
