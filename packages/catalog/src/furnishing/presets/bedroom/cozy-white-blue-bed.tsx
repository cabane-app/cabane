import { RoundedFurniturePanel } from "../construction";
import { CozyBedCover } from "./cozy-bed-cover";

/** Four horizontal timber boards, within the original double-bed headboard envelope. */
export function CozyBedHeadboard() {
  return (
    <group name="cozy-timber-headboard">
      {["#97734f", "#a17b53", "#93704c", "#a47f56"].map((color, index) => (
        <RoundedFurniturePanel
          key={color}
          name="cozy-headboard-plank"
          size={[1.7, 0.19025, 0.08]}
          position={[0, 0.425125 + index * 0.19325, -1.03]}
          color={color}
          radius={0.006}
          outlineColor="#75593e"
        />
      ))}
    </group>
  );
}

/** Layered ivory linen, navy throws and plump cushions inferred from the reference photo. */
export function CozyWhiteBlueBedding({
  variant = "cozy-white-blue",
  color,
}: {
  variant?: string;
  color?: string | undefined;
}) {
  const palette =
    variant === "cozy-sage"
      ? ["#8e9b78", "#bd8064"]
      : variant === "cozy-rose"
        ? ["#c99e96", "#a37863"]
        : variant === "cozy-oat"
          ? ["#b9a586", "#e3d2b7"]
          : ["#242e43", "#f6f0e5"];
  // On the mattress, navy underside clears ivory by .033-.018 = .015 m;
  // white underside clears navy by .074-.026-.033 = .015 m.
  return (
    <group name="cozy-white-blue-bedding">
      <CozyBedCover
        name="cozy-ivory-duvet"
        back={-0.61}
        front={1.06}
        lift={0}
        thickness={0.04}
        color={color ?? "#e6dfd1"}
      />
      <CozyBedCover
        name="cozy-navy-throw"
        back={0.27}
        front={1.063}
        lift={0.033}
        thickness={0.018}
        color={palette[0]}
      />
      <CozyBedCover
        name="cozy-plush-white-blanket"
        back={0.55}
        front={1.066}
        lift={0.074}
        thickness={0.026}
        color={palette[1]}
        plush
      />
      {[-0.39, 0.39].map((x) => (
        <group key={x}>
          <RoundedFurniturePanel
            name="cozy-sleeping-pillow"
            size={[0.7, 0.14, 0.4]}
            position={[x, 0.614, -0.72]}
            color={color ?? "#e9e1d3"}
            radius={0.065}
            outlineColor="#b7ad9c"
          />
          <RoundedFurniturePanel
            name="cozy-ivory-cushion"
            size={[0.48, 0.16, 0.47]}
            position={[x, 0.845, -0.55]}
            rotation={[0.65, x < 0 ? -0.08 : 0.08, x < 0 ? -0.06 : 0.06]}
            color="#f3ecdf"
            radius={0.07}
            outlineColor="#b9af9d"
          />
          <RoundedFurniturePanel
            name="cozy-navy-cushion"
            size={[0.4, 0.15, 0.4]}
            position={[x * 1.18, 0.805, -0.27]}
            rotation={[0.6, x < 0 ? -0.1 : 0.1, x < 0 ? -0.08 : 0.08]}
            color={palette[0]}
            radius={0.065}
            outlineColor="#74685b"
          />
        </group>
      ))}
      <RoundedFurniturePanel
        name="cozy-ivory-lumbar-cushion"
        size={[0.43, 0.14, 0.28]}
        position={[0, 0.754, -0.2]}
        rotation={[0.46, 0, -0.08]}
        color="#e9dfc9"
        radius={0.055}
        outlineColor="#b9aa91"
      />
    </group>
  );
}
