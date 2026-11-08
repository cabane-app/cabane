import { type SceneItemSize } from "@cabane/engine";
import { LibraryCabinetBase, LibraryPanel } from "./cabinet-parts";

export const ATELIER_LIBRARY_CREDENZA_SIZE = [1.8, 0.76, 0.44] as const;

export function AtelierLibraryCredenza({
  size = ATELIER_LIBRARY_CREDENZA_SIZE,
}: { size?: SceneItemSize } = {}) {
  return (
    <group
      name="atelier-library-credenza"
      scale={[size[0] / 1.8, size[1] / 0.76, size[2] / 0.44]}
      userData={{ walkCollider: true }}
    >
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.445, 0, 0]}>
          <LibraryCabinetBase width={0.89} height={0.72} depth={0.42} />
        </group>
      ))}
      <LibraryPanel size={[1.8, 0.04, 0.44]} at={[0, 0.74, 0]} color="#c9bea7" />
    </group>
  );
}
