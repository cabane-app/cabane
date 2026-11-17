import { BookRow } from "../living-room/book-row";

const shelves = [
  { x: -0.26, width: 0.48, height: 0.3, depth: 0.22 },
  { x: 0.22, width: 0.44, height: 0.26, depth: 0.19 },
  { x: -0.22, width: 0.53, height: 0.32, depth: 0.24 },
  { x: 0.13, width: 0.46, height: 0.28, depth: 0.21 },
] as const;

export function LibraryBooks({ shelf, index }: { shelf: number; index: number }) {
  const { x, width, height, depth } = shelves[index]!;
  return (
    <group position={[0, shelf, 0.034]}>
      <group position-x={x} scale-x={index % 2 ? -1 : 1}>
        <BookRow size={[width, height, depth]} />
      </group>
      {index === 1 && (
        <group position={[-0.17, 0.09, 0.01]} rotation-z={Math.PI / 2}>
          <BookRow size={[0.18, 0.25, 0.19]} />
        </group>
      )}
    </group>
  );
}
