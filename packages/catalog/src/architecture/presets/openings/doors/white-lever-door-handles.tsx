import { RoundedBox, JoineryMaterial, Outlines } from "@cabane/engine";

/** Compact unbranded white lever hardware; its rosette meets the50mm leaf face. */
export function WhiteLeverDoorHandles({ width, side }: { width: number; side: -1 | 1 }) {
  const radius = Math.min(0.027, width * 0.15);
  const leverWidth = Math.min(0.095, width * 0.5);
  const offset = Math.min(0.035, width * 0.18);
  return (
    <group
      name="opening-white-lever-handles"
      position={[side * (width / 2 - Math.min(0.08, width * 0.24)), -0.01, 0]}
    >
      {([-1, 1] as const).map((face) => (
        <group key={face}>
          <mesh
            name="white-lever-rosette"
            position={[0, 0, face * 0.03]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[radius, radius, 0.01, 16]} />
            <JoineryMaterial color="#f1f0eb" />
          </mesh>
          <mesh
            name="white-lever-neck"
            position={[0, 0, face * 0.043]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.011, 0.011, 0.02, 12]} />
            <JoineryMaterial color="#f1f0eb" />
          </mesh>
          <RoundedBox
            name="white-lever-arm"
            args={[leverWidth, 0.026, 0.02]}
            position={[-side * offset, 0, face * 0.054]}
            radius={0.008}
            smoothness={2}
            castShadow
          >
            <JoineryMaterial color="#f1f0eb" />
            <Outlines thickness={0.0015} color="#b9b7af" screenspace={false} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}
