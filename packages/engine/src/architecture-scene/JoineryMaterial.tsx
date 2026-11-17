import { useContext } from "react";
import { useGraphicsFeature } from "../graphics-features";
import { ToonMaterial } from "../rendering";
import { useScannedFinish } from "../scanned-finishes";
import { SceneStyleContext } from "../scene-style";

export function useDetailedJoinery() {
  const enabled = useGraphicsFeature("joinery");
  const style = useContext(SceneStyleContext);
  return enabled && style === "default";
}

/** Neutral veneer preserves the paint or stain chosen in Construct. */
export function JoineryMaterial({
  color,
  finish = "paint",
  vertexColors = false,
}: {
  color: string;
  finish?: "paint" | "wood" | "metal";
  vertexColors?: boolean;
}) {
  const detailed = useDetailedJoinery();
  const grain = useScannedFinish(finish === "wood" ? "joinery-oak" : undefined, "joinery");
  return detailed ? (
    <meshStandardMaterial
      key={grain ? "scanned" : "solid"}
      color={color}
      map={grain ?? null}
      vertexColors={vertexColors}
      roughness={finish === "metal" ? 0.31 : finish === "wood" ? 0.62 : 0.52}
      metalness={finish === "metal" ? 0.65 : 0}
    />
  ) : (
    <ToonMaterial color={color} vertexColors={vertexColors} />
  );
}
