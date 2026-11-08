import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { CabinetPanel, OakCabinetCase, OakDrawerFront, STONE } from "./cabinet-construction";

export const OAK_STONE_DRAWER_CABINET_SIZE = [1.2, 0.92, 0.66] as const;
export function OakStoneDrawerCabinet({
  size = OAK_STONE_DRAWER_CABINET_SIZE,
  variant = "default",
}: {
  size?: SceneItemSize;
  variant?: string;
}) {
  return (
    <group
      name="oak-stone-drawer-cabinet"
      scale={[size[0] / 1.2, size[1] / 0.92, size[2] / 0.66]}
      userData={{ walkCollider: true }}
    >
      <OakCabinetCase width={1.18} depth={0.62} />
      <OakDrawerFront width={1.114} y={0.754} height={0.196} z={0.29} />
      <OakDrawerFront width={1.114} y={0.519} height={0.258} z={0.29} />
      <OakDrawerFront width={1.114} y={0.253} height={0.258} z={0.29} />
      <CabinetPanel
        name="stone-countertop"
        size={[1.2, 0.04, 0.66]}
        at={[0, variant === "induction" ? 0.89 : 0.9, 0]}
        color={STONE}
        rounded
      />
      {variant === "induction" && (
        <group>
          <CabinetPanel
            name="induction-glass"
            size={[0.72, 0.008, 0.48]}
            at={[0, 0.915, 0]}
            color="#303b3c"
            rounded
          />
          {[-0.19, 0.19].flatMap((x) =>
            [-0.12, 0.12].map((z) => (
              <mesh
                key={`${x}:${z}`}
                name="induction-ring"
                position={[x, 0.92, z]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <ringGeometry args={[0.074, 0.078, 24]} />
                <ToonMaterial color="#79817c" />
              </mesh>
            )),
          )}
        </group>
      )}
    </group>
  );
}
