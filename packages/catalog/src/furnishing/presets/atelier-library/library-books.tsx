import { LibraryBlock } from "./cabinet-parts";

const COLORS = ["#b7a382", "#556861", "#9e6955", "#d2c6aa", "#646a73", "#967b59"];

/** Small editorial groups leave breathing room rather than filling every shelf. */
export function LibraryBooks({ shelf, alternate = false }: { shelf: number; alternate?: boolean }) {
  const start = alternate ? 0.06 : -0.45;
  return (
    <group>
      {COLORS.map((color, index) => {
        const height = 0.23 + [0.025, 0.055, 0, 0.04, 0.015, 0.06][index]!;
        return (
          <LibraryBlock
            key={color}
            size={[0.045, height, 0.18]}
            at={[start + index * 0.051, shelf + height / 2, 0.055]}
            color={color}
          />
        );
      })}
      <LibraryBlock
        size={[0.2, 0.035, 0.15]}
        at={[alternate ? -0.31 : 0.31, shelf + 0.0175, 0.05]}
        color="#c9b99a"
      />
      <LibraryBlock
        size={[0.17, 0.028, 0.14]}
        at={[alternate ? -0.3 : 0.3, shelf + 0.049, 0.05]}
        color="#7a897a"
      />
    </group>
  );
}
