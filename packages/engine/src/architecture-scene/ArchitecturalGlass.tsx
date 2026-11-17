import { useContext } from "react";
import type { MeshStandardMaterial } from "three";
import { ToonMaterial } from "../rendering";
import { SceneStyleContext } from "../scene-style";
import { useGraphicsFeature } from "../graphics-features";

const glassIncidence: MeshStandardMaterial["onBeforeCompile"] = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <opaque_fragment>",
    `// The reflection of a dielectric pane strengthens at a grazing angle.
    vec3 glassView = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
    float grazing = pow(1.0 - clamp(dot(normal, glassView), 0.0, 1.0), 5.0);
    diffuseColor.a *= 1.0 + 3.0 * (1.0 - roughness) * (1.0 - roughness) * grazing;
    #include <opaque_fragment>`,
  );
};

/** Thin glazing with environment reflections, drawn in the usual transparent pass. */
export function ArchitecturalGlass({ privacy = false }: { privacy?: boolean }) {
  const style = useContext(SceneStyleContext);
  const detailed = useGraphicsFeature("joinery");
  if (!detailed || style === "sims") {
    return (
      <ToonMaterial
        color={privacy ? "#aed8dc" : "#9bcbd2"}
        transparent
        opacity={privacy ? 0.43 : 0.48}
        depthWrite={false}
      />
    );
  }
  return (
    <meshStandardMaterial
      color={privacy ? "#c9d8d5" : "#cadad8"}
      roughness={privacy ? 0.56 : 0.11}
      metalness={0}
      opacity={privacy ? 0.57 : 0.21}
      transparent
      depthWrite={false}
      onBeforeCompile={glassIncidence}
    />
  );
}
