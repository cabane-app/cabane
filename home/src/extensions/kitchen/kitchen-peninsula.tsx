import { ToonMaterial } from "@cabane/engine";
import { MilledSurface, type Face } from "./milled-surface";
import { BrassCabinetHandle } from "./brass-cabinet-handle";
import { KITCHEN_CREAM, KITCHEN_OAK, KitchenBox, KitchenPanel } from "./kitchen-finish";

// A continuous tambour face: thirty shallow oak ribs follow a softly scalloped profile.
const tambour: Face[] = [];
for (let i = 0; i < 30 * 6; i++) {
  const x = (j: number) => -1.16 + (j * 2.32) / 180;
  const z = (j: number) => 0.001 + 0.016 * Math.sin((Math.PI * (j % 6)) / 6);
  tambour.push([
    [x(i), 0, z(i)],
    [x(i + 1), 0, z(i + 1)],
    [x(i + 1), 0.681, z(i + 1)],
    [x(i), 0.681, z(i)],
  ]);
  tambour.push([
    [x(i), 0.681, z(i)],
    [x(i + 1), 0.681, z(i + 1)],
    [x(i + 1), 0.681, -0.004],
    [x(i), 0.681, -0.004],
  ]);
}
export function KitchenPeninsula() {
  return (
    <group name="retour-et-barre-du-u-custom">
      <KitchenBox size={[0.46, 0.1, 1.15]} position={[3.61, 0.05, 1.24]} color="#94877a" />
      <KitchenBox
        size={[0.56, 0.737, 1.23]}
        position={[3.59, 0.4655, 1.265]}
        color={KITCHEN_CREAM}
      />
      {[0.855, 1.265, 1.675].map((z) => (
        <group key={z} position={[3.304, 0, z]} rotation={[0, -Math.PI / 2, 0]}>
          <KitchenPanel width={0.401} height={0.712} position={[0, 0.46, 0]} />
          <BrassCabinetHandle position={[0, 0.732, 0.04]} />
        </group>
      ))}
      <KitchenBox size={[2.28, 0.1, 0.45]} position={[2.59, 0.05, 2.16]} color="#816044" />
      <KitchenBox size={[2.4, 0.737, 0.56]} position={[2.59, 0.4655, 2.16]} color={KITCHEN_OAK} />
      <mesh position={[2.59, 0.126, 2.44]} castShadow receiveShadow>
        <MilledSurface faces={tambour} />
        <ToonMaterial color="#c38e57" />
      </mesh>
    </group>
  );
}
