import { RoundedBox } from "@cabane/engine";
import { Outlines, JoineryMaterial } from "@cabane/engine";

export function PanelDoorHandles({
  width,
  side: handleSide = 1,
  sash = false,
}: {
  width: number;
  side?: -1 | 1;
  sash?: boolean;
}) {
  const stile = Math.min(0.055, width * 0.14);
  const rosetteRadius = sash ? stile * 0.39 : Math.min(0.035, width * 0.15);
  const leverWidth = Math.min(0.16, width * 0.5);
  const leverOffset = Math.min(0.055, width * 0.18);
  return (
    <group
      name="opening-door-handles"
      position={[
        handleSide *
          (width / 2 - (sash ? Math.min(0.085, width * 0.22) : Math.min(0.13, width * 0.24))),
        -0.01,
        0,
      ]}
    >
      {([-1, 1] as const).map((face) => (
        <group key={face}>
          <mesh
            name="opening-door-handle-rosette"
            castShadow
            position={[0, 0, face * (sash ? 0.041 : 0.034)]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[rosetteRadius, rosetteRadius, 0.018, 18]} />
            <JoineryMaterial finish="metal" color="#aeb4b2" />
            <Outlines thickness={0.004} color="#555b59" screenspace={false} />
          </mesh>
          <mesh castShadow position={[0, 0, face * 0.052]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.04, 14]} />
            <JoineryMaterial finish="metal" color="#c3c7c5" />
          </mesh>
          <RoundedBox
            args={[leverWidth, 0.026, 0.028]}
            radius={0.011}
            smoothness={3}
            position={[-leverOffset * handleSide, 0, face * 0.076]}
            castShadow
          >
            <JoineryMaterial finish="metal" color="#b8bdbb" />
            <Outlines thickness={0.004} color="#555b59" screenspace={false} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}
