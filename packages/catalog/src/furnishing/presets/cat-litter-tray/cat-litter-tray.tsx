import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { RoundedFurniturePanel } from "../construction";

export const CAT_LITTER_TRAY_SIZE = [0.46, 0.18, 0.58] as const;

// One continuous molded shell, following the outside, rolled lip and cavity.
const shellProfile = [
  [0.42, 0.54, 0.05, 0],
  [0.43, 0.55, 0.055, 0.012],
  [0.456, 0.576, 0.064, 0.166],
  [0.46, 0.58, 0.066, 0.174],
  [0.452, 0.572, 0.062, 0.18],
  [0.436, 0.556, 0.054, 0.18],
  [0.428, 0.548, 0.05, 0.17],
  [0.398, 0.518, 0.04, 0.03],
  [0.388, 0.508, 0.035, 0.024],
] as const;

function createTrayShell() {
  const positions: number[] = [];
  const indices: number[] = [];
  const cornerSteps = 8;
  const ringCount = 4 * (cornerSteps + 1);
  for (const [width, depth, radius, y] of shellProfile) {
    for (let corner = 0; corner < 4; corner++) {
      const angle = (corner * Math.PI) / 2;
      const cx = (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - radius);
      const cz = (corner < 2 ? 1 : -1) * (depth / 2 - radius);
      for (let step = 0; step <= cornerSteps; step++) {
        const theta = angle + ((step / cornerSteps) * Math.PI) / 2;
        positions.push(cx + radius * Math.cos(theta), y, cz + radius * Math.sin(theta));
      }
    }
  }
  for (let ring = 0; ring < shellProfile.length - 1; ring++) {
    for (let i = 0; i < ringCount; i++) {
      const a = ring * ringCount + i;
      const b = ring * ringCount + ((i + 1) % ringCount);
      const c = a + ringCount;
      const d = b + ringCount;
      indices.push(a, c, b, b, c, d);
    }
  }
  const bottomCenter = positions.length / 3;
  positions.push(0, 0, 0, 0, 0.024, 0);
  const lastRing = (shellProfile.length - 1) * ringCount;
  for (let i = 0; i < ringCount; i++) {
    const next = (i + 1) % ringCount;
    indices.push(bottomCenter, i, next, bottomCenter + 1, lastRing + next, lastRing + i);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const trayShell = createTrayShell();

/** Generic open tray with a real recessed litter bed; origin at floor level. */
export function CatLitterTray({
  size = CAT_LITTER_TRAY_SIZE,
  color = "#9aaea7",
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="cat-litter-tray"
      scale={
        size.map((value, axis) => value / CAT_LITTER_TRAY_SIZE[axis]) as [number, number, number]
      }
      userData={{ walkCollider: true }}
    >
      <mesh name="hollow-tray-shell" geometry={trayShell} castShadow receiveShadow>
        <ToonMaterial color={color} />
        <Outlines color="#667c74" thickness={0.0015} screenspace={false} />
      </mesh>
      <RoundedFurniturePanel
        name="inset-litter-bed"
        size={[0.402, 0.034, 0.522]}
        position={[0, 0.04, 0]}
        radius={0.016}
        color="#c9bda5"
        outline={false}
      />
    </group>
  );
}
