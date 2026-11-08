import { type SceneItemSize } from "@cabane/engine";
import { CabinetPanel, OakDrawerFront, STONE } from "./cabinet-construction";

export const OAK_STONE_KITCHEN_ISLAND_SIZE = [2.2, 0.94, 1] as const;
export function OakStoneKitchenIsland({
  size = OAK_STONE_KITCHEN_ISLAND_SIZE,
}: {
  size?: SceneItemSize;
}) {
  return (
    <group
      name="oak-stone-kitchen-island"
      scale={[size[0] / 2.2, size[1] / 0.94, size[2]]}
      userData={{ walkCollider: true }}
    >
      <CabinetPanel
        name="island-recessed-plinth"
        size={[1.91, 0.11, 0.55]}
        at={[0, 0.055, 0.115]}
        color="#493f35"
      />
      <CabinetPanel
        name="island-oak-core"
        size={[2.06, 0.79, 0.63]}
        at={[0, 0.505, 0.115]}
        rounded
      />
      <CabinetPanel
        name="island-stone-top"
        size={[2.2, 0.04, 1]}
        at={[0, 0.92, 0]}
        color={STONE}
        rounded
      />
      {[-1.08, 1.08].map((x) => (
        <CabinetPanel
          key={x}
          name="stone-waterfall-end"
          size={[0.04, 0.9, 1]}
          at={[x, 0.45, 0]}
          color={STONE}
          rounded
        />
      ))}
      {[-0.516, 0.516].map((x) => (
        <group key={x}>
          <OakDrawerFront x={x} width={1.016} height={0.24} y={0.758} z={0.447} />
          <OakDrawerFront x={x} width={1.016} height={0.49} y={0.385} z={0.447} />
        </group>
      ))}
      {/* Quiet broad battens on the seating side; no individual outline noise. */}
      {Array.from({ length: 17 }, (_, i) => (
        <CabinetPanel
          key={i}
          name="island-oak-batten"
          size={[0.048, 0.75, 0.018]}
          at={[-0.96 + i * 0.12, 0.515, -0.208]}
          color={i % 3 === 0 ? "#826a52" : "#79604b"}
        />
      ))}
    </group>
  );
}
