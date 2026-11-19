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
import stoneUrl from "./assets/mossy-stone.webp?url";
import duffUrl from "./assets/understory-ground.webp?url";
import duffNormalUrl from "./assets/understory-ground-normal.webp?url";
import type { plantingMask } from "./planting-mask";
import grassUrl from "./assets/lawn-detail.webp?url";
import { countryDepth, type FieldPlot } from "./country-survey";

export const CountryLawnContext = createContext(false);
const grassScan = scan(grassUrl, 1, NoColorSpace);
export const countrysideStoneScan = scan(stoneUrl);
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

export function CountryTurf({ color, aoMap = null, plot, shade, cover, daylight = 1 }: Props) {
  const grass = useSyncExternalStore(grassScan.subscribe, grassScan.snapshot, none);
  const floorSource = cover ? duffScan : idle,
    reliefSource = cover ? duffRelief : idle;
  const stoneSource = plot ? countrysideStoneScan : idle;
  const stone = useSyncExternalStore(stoneSource.subscribe, stoneSource.snapshot, none);
  const duff = useSyncExternalStore(floorSource.subscribe, floorSource.snapshot, none),
    relief = useSyncExternalStore(reliefSource.subscribe, reliefSource.snapshot, none);
  const profile = plot ? "garden" : "lawn";
  const [settings] = useState(() => ({
    bedMask: { value: null as Texture | null },
    bedBounds: { value: new Vector4() },
    stoneMap: { value: null as Texture | null },
    hasStone: { value: false },
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
    settings.stoneMap.value = stone ?? null;
    settings.hasStone.value = !!stone;
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
  }, [plot, shade, daylight, settings, cover, duff, relief, stone]);
  const compile = useCallback<NonNullable<MeshStandardMaterial["onBeforeCompile"]>>(
    (shader) => {
      const varyings = "varying vec2 lawnMeters, terrainUv; varying float eyeDepth;\n";
      const planetVaryings = plot ? "varying vec3 planetBiome, planetMeters;\n" : "";
      shader.vertexShader =
        (plot ? "attribute vec2 surveyPoint; attribute vec3 biome;\n" : "") +
        planetVaryings +
        varyings +
        shader.vertexShader.replace(
          "#include <project_vertex>",
          `#include <project_vertex>
       lawnMeters=(modelMatrix*vec4(transformed,1.)).xz;
       ${plot ? "planetBiome=biome; planetMeters=transformed; lawnMeters=(modelMatrix*vec4(surveyPoint.x,0.,surveyPoint.y,1.)).xz;" : ""}
       terrainUv=uv;
       eyeDepth=-mvPosition.z;
       ${profile === "lawn" ? "" : countryDepth}`,
        );
      shader.fragmentShader =
        planetVaryings +
        varyings +
        turfNoise +
        shader.fragmentShader.replace("#include <map_fragment>", lawn);
      if (profile === "lawn") return;
      Object.assign(shader.uniforms, settings);
      shader.fragmentShader =
        "uniform sampler2D treeShade,bedMask,duff,duffNormal,stoneMap;uniform vec4 bedBounds;uniform bool hasDuff,hasStone; uniform vec2 plotCenter,plotHalf; uniform vec3 airColor;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          lawn,
          `
      vec2 debrisUv=vec2(0.);
      float coverage=0.,seaMask=0.;

      vec2 box=abs(lawnMeters-plotCenter)-plotHalf+.39;
      float edge=length(max(box,0.))+min(max(box.x,box.y),0.)-.39;
      if(planetBiome.x < .5 && edge < -.06) discard;
      ${lawn}

        vec2 bedUv=(lawnMeters-bedBounds.xy)/bedBounds.zw;
        vec2 maskEdge=min(bedUv,1.-bedUv)*bedBounds.zw;
        vec3 bed=texture2D(bedMask,bedUv).rgb*smoothstep(0.,1.5,min(maskEdge.x,maskEdge.y));
        debrisUv=mat2(.89,.456,-.456,.89)*lawnMeters/2.4;
        float shelter=bed.b;
        coverage=smoothstep(.09,.78,bed.r*(.67+.6*turfNoise(lawnMeters*1.5)))*smoothstep(.10,.8,edge);
        vec3 understory=mix(vec3(.65,.82,.59),vec3(.36,.52,.39),shelter);
        diffuseColor.rgb*=mix(vec3(1.),understory,bed.r);
        if(hasDuff && coverage>.001){
          vec3 leaves=texture2D(duff,debrisUv).rgb;
          float pockets=smoothstep(.22,.74,turfNoise(lawnMeters*.38)*.62+turfNoise(lawnMeters*1.77)*.38);
          diffuseColor.rgb=mix(diffuseColor.rgb,leaves*vec3(.59,.66,.53),coverage*(.16+.54*pockets));
        }
        diffuseColor.rgb*=1.-shelter*.47;
        diffuseColor.rgb*=1.-max(.38*bed.g,.21*texture2D(treeShade,terrainUv).g)*smoothstep(.1,1.4,edge);
      if(planetBiome.z > .025 || planetBiome.y < .095){
        // The seaward face has mossy headlands, exposed granite and shallow blue coves.
        vec2 stone=planetMeters.xz*.48+planetMeters.y*vec2(.31,-.26);
        float weathering=.64*turfNoise(stone)+.36*turfNoise(stone*3.8);
        float geology=planetBiome.y+.056*(weathering-.5);
        seaMask=1.-smoothstep(-.031,.014,geology);
        float depth=smoothstep(.008,.47,-geology);
        vec3 granite=mix(vec3(.099,.107,.106),vec3(.236,.215,.177),weathering);
        if(hasStone){
          vec3 grain=texture2D(stoneMap,stone*.31).rgb;
          granite*=.67+grain*1.55;
        }
        vec3 coast=mix(diffuseColor.rgb,granite,smoothstep(.28,.50,planetBiome.z+.35*(weathering-.5)));
        float shingle=1.-smoothstep(.014,.080,geology);
        coast=mix(coast,vec3(.19,.173,.131)*(.72+.47*weathering),shingle*.81);
        vec3 sea=mix(vec3(.043,.145,.137),vec3(.016,.052,.074),depth);
        float surf=1.-smoothstep(.012,.052,abs(geology+.021));
        sea+=vec3(.086,.115,.105)*surf*smoothstep(.31,.75,weathering);
        coast=mix(coast,sea,seaMask);
        diffuseColor.rgb=coast;
      }

    `,
        )
        .replace(
          "#include <opaque_fragment>",
          `
      #if NUM_DIR_LIGHTS > 0
        float terminator=smoothstep(-.50,.28,dot(normal,directionalLights[0].direction));
        outgoingLight*=mix(vec3(.41,.53,.65),vec3(1.),terminator);
      #endif
      float limb=pow(1.-clamp(dot(normal, isOrthographic?vec3(0.,0.,1.):normalize(vViewPosition)),0.,1.),4.);
      outgoingLight+=vec3(.047,.129,.185)*limb*(.1+.9*airColor.g)*smoothstep(30.,110.,eyeDepth);
      float haze=1.-exp(-max(0.,eyeDepth-65.)*.0017);
      if(!isOrthographic) outgoingLight=mix(outgoingLight,airColor,haze*.65);
      #include <opaque_fragment>
    `,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          roughnessFactor=mix(roughnessFactor,.31,planetBiome.x*seaMask);`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `
        #include <normal_fragment_maps>
        if(hasDuff && coverage>.001){vec2 grainNormal=texture2D(duffNormal,debrisUv).rg*2.-1.;
          normal=normalize(normal+mat3(viewMatrix)*vec3(grainNormal.x,0.,-grainNormal.y)*coverage*.53);}
      `,
        );
    },
    [profile, settings, plot],
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
