import { createContext, useCallback, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { Color, NoColorSpace, Vector2, type MeshStandardMaterial, type Texture } from "three";
import { scan } from "../scanned-finishes";
import grassUrl from "./assets/lawn-detail.webp?url";
import { countryDepth, type FieldPlot } from "./country-survey";

export const CountryLawnContext = createContext(false);
const grassScan = scan(grassUrl, 1, NoColorSpace);
const none = () => null;

type Props = {
  color: string;
  aoMap?: Texture | null;
  plot?: FieldPlot;
  shade?: Texture | null | undefined;
  distant?: boolean;
  daylight?: number;
};

// Two independently oriented blade samples share a continuous world-space finish.
// The scan carries only fine detail. Broad changes in colour never repeat with the image.
const lawn = /* glsl */ `
  float drift=sin(dot(lawnMeters,vec2(.106,.078))+.74*sin(lawnMeters.y*.163))
             +sin(dot(lawnMeters,vec2(-.071,.132))+.91*sin(lawnMeters.x*.094));
  float blades=0.;
  #ifdef USE_MAP
    vec2 warp=vec2(sin(lawnMeters.y*.53),sin(lawnMeters.x*.49))*.12;
    vec2 point=lawnMeters+warp;
    float a=texture2D(map,mat2(.8,.6,-.6,.8)*point/1.42).r;
    float b=texture2D(map,mat2(.28,-.96,.96,.28)*point/1.61+vec2(.31,.61)).r;
    blades=mix(a,b,smoothstep(-.7,.7,drift))-.5;
  #endif
  diffuseColor.rgb *= vec3(.58,.88,.79)*(1.+blades*1.48+drift*.036);
`;

export function CountryTurf({
  color,
  aoMap = null,
  plot,
  shade,
  distant = false,
  daylight = 1,
}: Props) {
  const grass = useSyncExternalStore(grassScan.subscribe, grassScan.snapshot, none);
  const profile = plot ? (distant ? "hills" : "garden") : "lawn";
  const [settings] = useState(() => ({
    treeShade: { value: null as Texture | null },
    plotCenter: { value: new Vector2() },
    plotHalf: { value: new Vector2() },
    airColor: { value: new Color() },
  }));
  useLayoutEffect(() => {
    settings.treeShade.value = shade ?? null;
    if (plot) {
      settings.plotCenter.value.set(plot.x, plot.z);
      settings.plotHalf.value.set(plot.width / 2, plot.depth / 2);
    }
    settings.airColor.value.setRGB(
      0.052 + 0.418 * daylight,
      0.07 + 0.52 * daylight,
      0.1 + 0.58 * daylight,
    );
  }, [plot, shade, daylight, settings]);
  const compile = useCallback<NonNullable<MeshStandardMaterial["onBeforeCompile"]>>(
    (shader) => {
      const varyings = "varying vec2 lawnMeters, terrainUv; varying float eyeDepth;\n";
      shader.vertexShader =
        varyings +
        shader.vertexShader.replace(
          "#include <project_vertex>",
          `#include <project_vertex>
       lawnMeters=(modelMatrix*vec4(transformed,1.)).xz;
       terrainUv=uv;
       eyeDepth=-mvPosition.z;
       ${profile === "lawn" ? "" : countryDepth}`,
        );
      shader.fragmentShader =
        varyings + shader.fragmentShader.replace("#include <map_fragment>", lawn);
      if (profile === "lawn") return;
      Object.assign(shader.uniforms, settings);
      shader.fragmentShader =
        "uniform sampler2D treeShade; uniform vec2 plotCenter,plotHalf; uniform vec3 airColor;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          lawn,
          lawn +
            `
      vec2 box=abs(lawnMeters-plotCenter)-plotHalf+.39;
      float edge=length(max(box,0.))+min(max(box.x,box.y),0.)-.39;
      if(edge < -.06) discard;
      ${profile === "garden" ? "diffuseColor.rgb*=1.-.29*texture2D(treeShade,terrainUv).g*smoothstep(1.,5.,edge);" : ""}
    `,
        )
        .replace(
          "#include <opaque_fragment>",
          `
      float haze=1.-exp(-max(0.,eyeDepth-65.)*.0017);
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
      customProgramCacheKey={() => "country-lawn-" + profile}
      onBeforeCompile={compile}
      map={grass ?? null}
      aoMap={aoMap}
      color={color}
      roughness={1}
    />
  );
}
