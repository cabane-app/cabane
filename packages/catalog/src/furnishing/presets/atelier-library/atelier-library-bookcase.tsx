import { type SceneItemSize } from "@cabane/engine";
import { LibraryBlock, LibraryCabinetBase, LibraryPanel, LIBRARY_SHADOW } from "./cabinet-parts";
import { LibraryBooks } from "./library-books";

export const ATELIER_LIBRARY_BOOKCASE_SIZE = [1.2, 2.5, 0.42] as const;

/** Furniture-grade oak library bay with closed storage and four dressed shelves. */
export function AtelierLibraryBookcase({
  size = ATELIER_LIBRARY_BOOKCASE_SIZE,
}: { size?: SceneItemSize } = {}) {
  return (
    <group
      name="atelier-library-bookcase"
      scale={[size[0] / 1.2, size[1] / 2.5, size[2] / 0.42]}
      userData={{ walkCollider: true }}
    >
      <LibraryCabinetBase width={1.2} height={0.66} depth={0.42} />
      <LibraryBlock size={[1.12, 1.8, 0.025]} at={[0, 1.56, -0.1955]} color={LIBRARY_SHADOW} />
      {[-1, 1].map((side) => (
        <LibraryPanel key={side} size={[0.04, 1.84, 0.42]} at={[side * 0.58, 1.58, 0]} />
      ))}
      <LibraryPanel size={[1.12, 0.045, 0.42]} at={[0, 2.4775, 0]} />
      {[0.7, 1.14, 1.58, 2.02].map((height, index) => (
        <group key={height}>
          <LibraryPanel size={[1.12, 0.035, 0.385]} at={[0, height - 0.0175, 0.0175]} />
          <LibraryBooks shelf={height} alternate={index % 2 === 1} />
        </group>
      ))}
    </group>
  );
}
