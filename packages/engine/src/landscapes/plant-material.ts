import { withStockShadowDepth } from "../shadow-map-cache";
import { MeshLambertMaterial, type MeshStandardMaterial, type Color } from "three";
import { countryDepth } from "./country-survey";

export type GardenLight = { breeze: { value: number }; air: { value: Color } };

/** Fixed stems, moving tips, and aerial perspective on the distant trees. */
export function plantMaterial(
  source: MeshStandardMaterial,
  light: GardenLight,
  foliage: boolean,
  distant: boolean,
  lowCover = false,
) {
  // Slender blades and small horizon crowns only need diffuse light. Nearby
  // tree canopies retain their full material and their shadows on the lawn.
  const material =
    lowCover || distant
      ? new MeshLambertMaterial({
          map: source.map,
          color: source.color,
          side: source.side,
          alphaTest: source.alphaTest,
          vertexColors: source.vertexColors,
          alphaMap: source.alphaMap,
        })
      : source.clone();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.gardenTime = light.breeze;
    shader.uniforms.gardenAir = light.air;
    shader.vertexShader =
      "uniform float gardenTime; varying float gardenDepth;\n" + shader.vertexShader;
    if (foliage)
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
      #include <begin_vertex>
      vec2 stem=instanceMatrix[3].xz;
      float tip=clamp(position.y,0.,1.);
      float gust=sin(stem.x*.18+stem.y*.09+gardenTime*1.72)+.34*sin(stem.y*.39+gardenTime*2.61+position.y*5.);
      transformed.xz+=vec2(.012,.006)*gust*tip*tip;
    `,
      );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `
      #include <project_vertex>
      gardenDepth=-mvPosition.z;
      ${distant ? countryDepth : ""}
    `,
    );
    if (lowCover) {
      // Slender blades take most of their diffuse light from the sky dome.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
        vec3 skyUp=normalize(mat3(viewMatrix)*vec3(0.,1.,0.));
        normal=normalize(normal*.52+skyUp*.82);`,
      );
    }
    if (distant) {
      shader.fragmentShader =
        "uniform vec3 gardenAir; varying float gardenDepth;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `
        float mist=1.-exp(-max(0.,gardenDepth-32.)*.0038);
        if(!isOrthographic) outgoingLight=mix(outgoingLight,gardenAir,mist*.78);
        #include <opaque_fragment>
      `,
      );
    }
  };
  material.customProgramCacheKey = () =>
    "garden-surface-" + foliage + "-" + distant + "-" + lowCover;
  return material instanceof MeshLambertMaterial ? material : withStockShadowDepth(material);
}
