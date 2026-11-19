import { createContext, useCallback, useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  Color,
  NoColorSpace,
  Vector2,
  Vector4,
  type MeshStandardMaterial,
  type Texture,
} from "three";
import { scan } from "../scanned-finishes";
import duffUrl from "./assets/understory-ground.webp?url";
import duffNormalUrl from "./assets/understory-ground-normal.webp?url";
import type { plantingMask } from "./planting-mask";
import grassUrl from "./assets/lawn-detail.webp?url";
import { countryDepth, type FieldPlot } from "./country-survey";

export const CountryLawnContext = createContext(false);
const grassScan = scan(grassUrl, 1, NoColorSpace);
const duffScan = scan(duffUrl),
  duffRelief = scan(duffNormalUrl, 1, NoColorSpace);
const none = () => null;
const idle = { subscribe: () => () => {}, snapshot: none };

type Props = {
  color: string;
  aoMap?: Texture | null;
  plot?: FieldPlot;
  shade?: Texture | null | undefined;
  cover?: ReturnType<typeof plantingMask>;
  distant?: boolean;
  daylight?: number;
};

// Two independently oriented blade samples share a continuous world-space finish.
// The scan carries only fine detail. Broad changes in colour never repeat with the image.
const turfNoise = /* glsl */ `
  float turfHash(vec2 p) {
    vec3 q=fract(vec3(p.xyx)*.1031);
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  float turfNoise(vec2 p) {
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(mix(turfHash(i),turfHash(i+vec2(1.,0.)),f.x),
               mix(turfHash(i+vec2(0.,1.)),turfHash(i+1.),f.x),f.y);
  }
`;

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
  vec2 groundUV=mat2(.86,.51,-.51,.86)*lawnMeters;
  float growth=.64*turfNoise(groundUV*.16)+.36*turfNoise(groundUV*.51+17.);
  float warmth=smoothstep(.17,.84,growth);
  float grey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
  diffuseColor.rgb=mix(vec3(grey),diffuseColor.rgb,.69)
    *mix(vec3(.71,.83,.80),vec3(.84,.81,.73),warmth)
    *(1.+blades*1.10+(growth-.5)*.14);
`;

export function CountryTurf({
  color,
  aoMap = null,
  plot,
  shade,
  cover,
  distant = false,
  daylight = 1,
}: Props) {
  const grass = useSyncExternalStore(grassScan.subscribe, grassScan.snapshot, none);
  const floorSource = cover ? duffScan : idle,
    reliefSource = cover ? duffRelief : idle;
  const duff = useSyncExternalStore(floorSource.subscribe, floorSource.snapshot, none),
    relief = useSyncExternalStore(reliefSource.subscribe, reliefSource.snapshot, none);
  const profile = plot ? (distant ? "hills" : "garden") : "lawn";
  const [settings] = useState(() => ({
    bedMask: { value: null as Texture | null },
    bedBounds: { value: new Vector4() },
    duff: { value: null as Texture | null },
    duffNormal: { value: null as Texture | null },
    hasDuff: { value: false },
    treeShade: { value: null as Texture | null },
    plotCenter: { value: new Vector2() },
    plotHalf: { value: new Vector2() },
    airColor: { value: new Color() },
  }));
  useLayoutEffect(() => {
    settings.bedMask.value = cover?.texture ?? null;
    if (cover) settings.bedBounds.value.copy(cover.bounds);
    settings.duff.value = duff ?? null;
    settings.duffNormal.value = relief ?? null;
    settings.hasDuff.value = Boolean(duff && relief);
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
  }, [plot, shade, daylight, settings, cover, duff, relief]);
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
        varyings + turfNoise + shader.fragmentShader.replace("#include <map_fragment>", lawn);
      if (profile === "lawn") return;
      Object.assign(shader.uniforms, settings);
      shader.fragmentShader =
        "uniform sampler2D treeShade,bedMask,duff,duffNormal;uniform vec4 bedBounds;uniform bool hasDuff; uniform vec2 plotCenter,plotHalf; uniform vec3 airColor;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          lawn,
          lawn +
            `
      vec2 box=abs(lawnMeters-plotCenter)-plotHalf+.39;
      float edge=length(max(box,0.))+min(max(box.x,box.y),0.)-.39;
      if(edge < -.06) discard;
      ${
        profile === "garden"
          ? `
        vec2 bedUv=(lawnMeters-bedBounds.xy)/bedBounds.zw;
        vec3 bed=texture2D(bedMask,bedUv).rgb;
        vec2 debrisUv=mat2(.89,.456,-.456,.89)*lawnMeters/2.4;
        float shelter=bed.b;
        float coverage=smoothstep(.09,.78,bed.r*(.67+.6*turfNoise(lawnMeters*1.5)))*smoothstep(.10,.8,edge);
        vec3 understory=mix(vec3(.65,.82,.59),vec3(.36,.52,.39),shelter);
        diffuseColor.rgb*=mix(vec3(1.),understory,bed.r);
        if(hasDuff){
          vec3 leaves=texture2D(duff,debrisUv).rgb;
          float pockets=smoothstep(.22,.74,turfNoise(lawnMeters*.38)*.62+turfNoise(lawnMeters*1.77)*.38);
          diffuseColor.rgb=mix(diffuseColor.rgb,leaves*vec3(.59,.66,.53),coverage*(.16+.54*pockets));
        }
        diffuseColor.rgb*=1.-shelter*.47;
        diffuseColor.rgb*=1.-max(.38*bed.g,.21*texture2D(treeShade,terrainUv).g)*smoothstep(.1,1.4,edge);
      `
          : ""
      }
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
      if (profile === "garden")
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <normal_fragment_maps>",
          `
        #include <normal_fragment_maps>
        if(hasDuff){vec2 grainNormal=texture2D(duffNormal,debrisUv).rg*2.-1.;
          normal=normalize(normal+mat3(viewMatrix)*vec3(grainNormal.x,0.,-grainNormal.y)*coverage*.53);}
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
