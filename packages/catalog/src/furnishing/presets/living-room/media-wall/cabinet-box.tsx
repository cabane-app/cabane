import { RoundedFurniturePanel } from "../../construction";

interface CabinetProps {
  width: number;
  height: number;
  columns: number;
  worktop: [number, number, number];
}

/** Two rows of lacquered fronts stand proud of a shadowed case and inset toe kick. */
export function CabinetBox({ width, height, columns, worktop }: CabinetProps) {
  const frontWidth = (width - 0.045) / columns;
  const frontHeight = (height - 0.076) / 2;
  return (
    <group>
      <RoundedFurniturePanel
        name="recessed-plinth"
        size={[width - 0.09, 0.056, 0.31]}
        position={[0, 0.028, 0.019]}
        color="#c7c1b5"
        radius={0.004}
        outline={false}
      />
      <RoundedFurniturePanel
        size={[width, height - 0.052, 0.375]}
        position={[0, (height + 0.052) / 2, 0.0025]}
        color="#ded9ce"
        radius={0.008}
      />
      {[0, 1].flatMap((row) =>
        Array.from({ length: columns }, (_, column) => (
          <RoundedFurniturePanel
            key={row * columns + column}
            name="lacquered-drawer-front"
            size={[frontWidth - 0.008, frontHeight - 0.007, 0.039]}
            position={[
              (column - (columns - 1) / 2) * frontWidth,
              0.062 + (row + 0.5) * frontHeight,
              -0.1985,
            ]}
            color={row === 1 ? "#f7f4ed" : "#eeeae1"}
            radius={0.008}
            outline={false}
          />
        )),
      )}
      <RoundedFurniturePanel
        name="overhanging-stone-top"
        size={worktop}
        position={[0, height + worktop[1] / 2, 0]}
        color="#f4f0e8"
        radius={0.013}
        outlineColor="#a6a098"
      />
    </group>
  );
}
