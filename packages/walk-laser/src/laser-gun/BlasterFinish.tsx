import { glovePalette } from "./glove-palette";
import { ToonMaterial } from "@cabane/engine";

/** A single coating palette for the blaster's procedural parts. */
export function BlasterFinish({
  kind,
}: {
  kind: "armor" | "chassis" | "trim" | "grip" | "energy" | "hot" | "recess" | "glint";
}) {
  const color = {
    armor: glovePalette.armor,
    chassis: "#44384d",
    trim: glovePalette.trim,
    grip: glovePalette.leather,
    energy: "#51e8f3",
    hot: "#f26a35",
    recess: "#231c2b",
    glint: "#f2ffff",
  }[kind];
  const glowing = kind === "energy" || kind === "hot" || kind === "glint";
  return (
    <ToonMaterial
      color={color}
      emissive={glowing ? color : "#000000"}
      emissiveIntensity={glowing ? 0.65 : 0}
      toneMapped={!glowing}
    />
  );
}
