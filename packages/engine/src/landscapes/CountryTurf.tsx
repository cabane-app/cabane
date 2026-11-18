import { createContext, useCallback, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { Color, Vector2, type MeshStandardMaterial, type Texture } from "three";
import { scan } from "../scanned-finishes";
import grassUrl from "./assets/field-margin.webp?url";
import { countryDepth, type FieldPlot } from "./country-survey";

export const CountryLawnContext = createContext(false);
const grassScan = scan(grassUrl);
const none = () => null;

type Props = {
  color: string;
  aoMap?: Texture | null;
  plot?: FieldPlot;
  survey?: Texture;
  distant?: boolean;
  daylight?: number;
};
const turf = /* glsl */ `
#ifdef USE_MAP
  vec3 grass=texture2D(map,countryMeters/2.).rgb;
  vec3 swath=texture2D(map,mat2(.8,.6,-.6,.8)*countryMeters/11.).rgb;
  // Albedo and blade detail have identical world coordinates on either side of the parcel.
  diffuseColor.rgb *= clamp(grass / vec3(.19,.173,.115),.30,2.5)*(.49+.42*swath.g);
#endif
`;

export function CountryTurf({
  color,
  aoMap = null,
  plot,
  survey,
  distant = false,
  daylight = 1,
}: Props) {
  const grass = useSyncExternalStore(grassScan.subscribe, grassScan.snapshot, none);
  const profile = plot ? (distant ? "valley" : "pasture") : "lawn";
  const [settings] = useState(() => ({
    aerial: { value: null as Texture | null },
    plotCenter: { value: new Vector2() },
    plotHalf: { value: new Vector2() },
    airColor: { value: new Color() },
  }));
  useLayoutEffect(() => {
    settings.aerial.value = survey ?? null;
    if (plot) {
      settings.plotCenter.value.set(plot.x, plot.z);
      settings.plotHalf.value.set(plot.width / 2, plot.depth / 2);
    }
    settings.airColor.value.setRGB(
      0.052 + 0.418 * daylight,
      0.07 + 0.52 * daylight,
      0.1 + 0.58 * daylight,
    );
  }, [plot, survey, daylight, settings]);
  const compile = useCallback<NonNullable<MeshStandardMaterial["onBeforeCompile"]>>(
    (shader) => {
      shader.vertexShader =
        "varying vec2 countryMeters; varying vec2 countryUv; varying float countryDepthMeters;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `#include <project_vertex>
      countryMeters=(modelMatrix*vec4(transformed,1.)).xz;
      countryUv=uv;
      countryDepthMeters=-mvPosition.z;
      ${profile === "lawn" ? "" : countryDepth}`,
      );
      shader.fragmentShader =
        "varying vec2 countryMeters; varying vec2 countryUv; varying float countryDepthMeters;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", turf);
      if (profile === "lawn") return;
      Object.assign(shader.uniforms, settings);
      shader.fragmentShader =
        "uniform sampler2D aerial; uniform vec2 plotCenter,plotHalf; uniform vec3 airColor;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        turf,
        turf +
          `
      vec2 box=abs(countryMeters-plotCenter)-plotHalf+.39;
      float edge=length(max(box,0.))+min(max(box.x,box.y),0.)-.39;
      if(edge < -.06) discard;
      vec3 photo=texture2D(aerial,countryUv).rgb;
      float blades=1.;
      #ifdef USE_MAP
        blades=clamp(.70+1.7*grass.g,.7,1.38);
      #endif
      // The clearing opens irregularly into the surveyed fields. Its edge is
      // derived from the same albedo used for the lawn and receives the same sun.
      float grain=texture2D(aerial,countryUv*2.).g;
      float pasture=${profile === "valley" ? "1." : "smoothstep(0.8,19.,edge+(grain-.11)*12.)"};
      diffuseColor.rgb=mix(diffuseColor.rgb,photo*vec3(1.21,1.13,1.01)*blades,pasture);
    `,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `
      float haze=1.-exp(-max(0.,countryDepthMeters-65.)*.0017);
      outgoingLight=mix(outgoingLight,airColor,haze*.83);
      #include <opaque_fragment>
    `,
      );
    },
    [profile, settings],
  );
  return (
    <meshStandardMaterial
      key={profile}
      customProgramCacheKey={() => "country-grounds-" + profile}
      onBeforeCompile={compile}
      map={grass ?? null}
      aoMap={aoMap}
      color={color}
      roughness={1}
    />
  );
}
