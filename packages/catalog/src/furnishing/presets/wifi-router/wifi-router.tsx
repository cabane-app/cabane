import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const WIFI_ROUTER_SIZE: SceneItemSize = [0.24, 0.2, 0.164];

/** Generic static internet box; Y=0 is the tabletop and the indicators face +Z. */
export function WifiRouter({ size = WIFI_ROUTER_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="wifi-router"
      scale={size.map((value, axis) => value / WIFI_ROUTER_SIZE[axis]) as [number, number, number]}
    >
      <RoundedFurniturePanel
        name="router-enclosure"
        size={[0.24, 0.045, 0.16]}
        position={[0, 0.03, 0]}
        color="#e9e8e2"
        outlineColor="#989a95"
        radius={0.009}
      />
      {[-0.09, 0.09].flatMap((x) =>
        [-0.05, 0.05].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.005, z]}>
            <cylinderGeometry args={[0.009, 0.009, 0.01, 12]} />
            <ToonMaterial color="#42494b" />
          </mesh>
        )),
      )}
      {[-0.093, 0.093].map((x) => (
        <group key={x}>
          <RoundedFurniturePanel
            size={[0.018, 0.019, 0.018]}
            position={[x, 0.052, -0.057]}
            color="#454d50"
            radius={0.004}
            outline={false}
          />
          <mesh name="antenna" position={[x, 0.125, -0.057]} castShadow>
            <capsuleGeometry args={[0.005, 0.14, 4, 8]} />
            <ToonMaterial color="#454d50" />
          </mesh>
        </group>
      ))}
      {[-0.075, -0.045, -0.015, 0.015].map((x, index) => (
        <mesh key={x} name="static-status-lens" position={[x, 0.03, 0.0805]}>
          <boxGeometry args={[0.007, 0.004, 0.003]} />
          <ToonMaterial color={index === 0 ? "#7da893" : "#677b77"} />
        </mesh>
      ))}
      {[-0.045, -0.015, 0.015, 0.045].map((x) => (
        <mesh key={x} name="ethernet-port" position={[x, 0.028, -0.0805]}>
          <boxGeometry args={[0.016, 0.012, 0.003]} />
          <ToonMaterial color="#454d50" />
        </mesh>
      ))}
      {[-0.045, -0.015, 0.015, 0.045].map((x) => (
        <mesh key={x} name="vent-rib" position={[x, 0.0525, -0.005]}>
          <boxGeometry args={[0.004, 0.003, 0.045]} />
          <ToonMaterial color="#a4aaa6" />
        </mesh>
      ))}
    </group>
  );
}
