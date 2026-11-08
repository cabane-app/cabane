import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import {
  CabinetPanel,
  OakCabinetCase,
  OakDrawerFront,
  STONE,
  BRONZE,
} from "./cabinet-construction";

export const OAK_STONE_SINK_CABINET_SIZE = [1.2, 1.22, 0.66] as const;
export function OakStoneSinkCabinet({
  size = OAK_STONE_SINK_CABINET_SIZE,
}: {
  size?: SceneItemSize;
}) {
  return (
    <group
      name="oak-stone-sink-cabinet"
      scale={[size[0] / 1.2, size[1] / 1.22, size[2] / 0.66]}
      userData={{ walkCollider: true }}
    >
      <OakCabinetCase width={1.18} depth={0.62} />
      {[-0.281, 0.281].map((x) => (
        <OakDrawerFront key={x} width={0.552} x={x} y={0.488} height={0.728} z={0.29} />
      ))}
      {[-0.465, 0.465].map((x) => (
        <CabinetPanel
          key={x}
          name="stone-counter-side"
          size={[0.27, 0.04, 0.66]}
          at={[x, 0.9, 0]}
          color={STONE}
        />
      ))}
      {[-0.265, 0.265].map((z) => (
        <CabinetPanel
          key={z}
          name="stone-counter-rail"
          size={[0.66, 0.04, 0.13]}
          at={[0, 0.9, z]}
          color={STONE}
        />
      ))}
      <CabinetPanel
        name="undermount-basin-bottom"
        size={[0.66, 0.018, 0.4]}
        at={[0, 0.758, 0]}
        color="#6b7774"
      />
      {[-0.321, 0.321].map((x) => (
        <CabinetPanel
          key={x}
          name="basin-side"
          size={[0.018, 0.141, 0.4]}
          at={[x, 0.8375, 0]}
          color="#9aa5a0"
        />
      ))}
      {[-0.191, 0.191].map((z) => (
        <CabinetPanel
          key={z}
          name="basin-wall"
          size={[0.624, 0.141, 0.018]}
          at={[0, 0.8375, z]}
          color="#9aa5a0"
        />
      ))}
      <mesh name="sink-drain" position={[0, 0.769, 0]}>
        <cylinderGeometry args={[0.027, 0.027, 0.004, 16]} />
        <ToonMaterial color="#444e4b" />
      </mesh>
      <mesh name="bronze-tap-stem" position={[0, 1.063, -0.263]}>
        <cylinderGeometry args={[0.017, 0.017, 0.286, 12]} />
        <ToonMaterial color={BRONZE} />
      </mesh>
      <mesh name="bronze-tap-spout" position={[0, 1.203, -0.163]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.017, 0.017, 0.2, 12]} />
        <ToonMaterial color={BRONZE} />
      </mesh>
      <mesh name="tap-outlet" position={[0, 1.18, -0.063]}>
        <cylinderGeometry args={[0.017, 0.017, 0.046, 12]} />
        <ToonMaterial color={BRONZE} />
      </mesh>
      <CabinetPanel
        name="tap-lever"
        size={[0.07, 0.012, 0.016]}
        at={[0.034, 0.96, -0.263]}
        color={BRONZE}
      />
    </group>
  );
}
