import { type SceneItemSize } from "@cabane/engine";
import { LibraryCabinetBase, LibraryPanel } from "./cabinet-parts";

export const ATELIER_LIBRARY_BENCH_SIZE = [1.8, 0.48, 0.55] as const;

export function AtelierLibraryBench({
  size = ATELIER_LIBRARY_BENCH_SIZE,
}: { size?: SceneItemSize } = {}) {
  return (
    <group
      name="atelier-library-bench"
      scale={[size[0] / 1.8, size[1] / 0.48, size[2] / 0.55]}
      userData={{ walkCollider: true }}
    >
      <LibraryCabinetBase width={1.8} height={0.38} depth={0.55} />
      <LibraryPanel size={[1.8, 0.025, 0.55]} at={[0, 0.3925, 0]} />
      {[-1, 1].map((side) => (
        <LibraryPanel
          key={side}
          size={[0.868, 0.075, 0.51]}
          at={[side * 0.44, 0.4425, 0]}
          color="#c2b99e"
        />
      ))}
    </group>
  );
}
