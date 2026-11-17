import { ToonMaterial } from "@cabane/engine";
import { KITCHEN_BRASS, type KitchenVector3 } from "./kitchen-finish";

export function BrassCabinetHandle({
  position,
  vertical = false,
}: {
  readonly position: KitchenVector3;
  readonly vertical?: boolean;
}) {
  return (
    <group position={position} rotation={[0, 0, vertical ? Math.PI / 2 : 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.0095, 0.153, 2, 10]} />
        <ToonMaterial color={KITCHEN_BRASS} />
      </mesh>
      {[-0.061, 0.061].map((x) => (
        <mesh key={x} position={[x, 0, -0.021]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.009, 0.012, 0.045, 8]} />
          <ToonMaterial color={KITCHEN_BRASS} />
        </mesh>
      ))}
    </group>
  );
}
