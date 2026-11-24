import {
  createContext,
  useCallback,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from "react";
import { Color, Vector2, Vector4, type MeshStandardMaterial, type Texture } from "three";
import type { plantingMask } from "./planting-mask";
import { countryDepth, type FieldPlot } from "./country-survey";
import { planetScans } from "./planet-scans";

export const CountryLawnContext = createContext(false);
const { grass: grassScan, duff: duffScan, duffNormal: duffRelief } = planetScans;
const none = () => null;
const idle = { subscribe: () => () => {}, snapshot: none };

// The detailed sun map covers the house. Let canopy shadows yield to the
// landscape's baked shelter before a receiver crosses any face of that map.
const countrysideLights = /* glsl */ `
  #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
    DirectionalLightShadow canopyShadows[ NUM_DIR_LIGHT_SHADOWS ];
    #pragma unroll_loop_start
    for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
      {
        vec3 coord = vDirectionalShadowCoord[ i ].xyz / vDirectionalShadowCoord[ i ].w;
        vec3 margin = min(coord, 1.0 - coord);
        canopyShadows[ i ] = directionalLightShadows[ i ];
        canopyShadows[ i ].shadowIntensity *= smoothstep(0.0, 0.14, min(min(margin.x, margin.y), margin.z));
      }
    }
    #pragma unroll_loop_end
    #define directionalLightShadows canopyShadows
  #endif
  #include <lights_fragment_begin>
  #undef directionalLightShadows
`;

type Props = Pick<
  ComponentProps<"meshStandardMaterial">,
  | "alphaMap"
  | "vertexColors"
  | "transparent"
  | "depthWrite"
  | "polygonOffset"
  | "polygonOffsetFactor"
  | "polygonOffsetUnits"
> & {
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

export function CountryTurf({
  color,
  aoMap = null,
  plot,
  shade,
  cover,
  daylight = 1,
  ...surface
}: Props) {
  const grass = useSyncExternalStore(grassScan.subscribe, grassScan.snapshot, none);
  const floorSource = cover ? duffScan : idle,
    reliefSource = cover ? duffRelief : idle;
  const duff = useSyncExternalStore(floorSource.subscribe, floorSource.snapshot, none),
    relief = useSyncExternalStore(reliefSource.subscribe, reliefSource.snapshot, none);
  const profile = plot ? "garden" : "lawn";
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
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_begin>",
        countrysideLights,
      );
      if (profile === "lawn") return;
      Object.assign(shader.uniforms, settings);
      shader.fragmentShader =
        "uniform sampler2D treeShade,bedMask,duff,duffNormal;uniform vec4 bedBounds;uniform bool hasDuff; uniform vec2 plotCenter,plotHalf; uniform vec3 airColor;\n" +
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
      if(edge < 36.) {
        ${lawn}

        vec2 bedUv=(lawnMeters-bedBounds.xy)/bedBounds.zw;
        vec2 maskEdge=min(bedUv,1.-bedUv)*bedBounds.zw;
        // The surveyed cap and the parcel sample the same lawn at their shared edge.
        float verge=smoothstep(.06,1.25+.85*growth,edge);
        vec3 bed=texture2D(bedMask,bedUv).rgb*verge*smoothstep(0.,1.5,min(maskEdge.x,maskEdge.y));
        debrisUv=mat2(.89,.456,-.456,.89)*lawnMeters/2.4;
        float shelter=bed.b;
        coverage=smoothstep(.09,.78,bed.r*(.67+.6*turfNoise(lawnMeters*1.5)));
        vec3 understory=mix(vec3(.65,.82,.59),vec3(.36,.52,.39),shelter);
        diffuseColor.rgb*=mix(vec3(1.),understory,bed.r);
        if(hasDuff && coverage>.001){
          vec3 leaves=texture2D(duff,debrisUv).rgb;
          float pockets=smoothstep(.22,.74,turfNoise(lawnMeters*.38)*.62+turfNoise(lawnMeters*1.77)*.38);
          diffuseColor.rgb=mix(diffuseColor.rgb,leaves*vec3(.59,.66,.53),coverage*(.16+.54*pockets));
        }
        diffuseColor.rgb*=1.-shelter*.30;
        diffuseColor.rgb*=1.-max(.38*bed.g,.21*texture2D(treeShade,terrainUv).g)*smoothstep(.1,1.4,edge);
      }
      if(edge > 14.){
        float land=planetBiome.y, height=planetBiome.x-1.;
        // Broad meadow colour follows the slopes. No projected lawn scan on the far side.
        float meadow=clamp(.48+height*2.5+.24*sin(planetMeters.x*.052+planetMeters.z*.024)
                           +.14*sin(planetMeters.y*.069-planetMeters.z*.041),0.,1.);
        vec3 turf=mix(vec3(.048,.092,.056),vec3(.133,.157,.078),meadow);
        vec2 soil=planetMeters.xy*.31+planetMeters.z*vec2(.17,-.23);
        turf*=.94+.095*turfNoise(soil);
        float bed=height*27.+.27*sin(planetMeters.z*.18)+.19*sin(planetMeters.x*.22);
        float seam=smoothstep(.66,.83,fract(bed))*(1.-smoothstep(.87,1.,fract(bed)));
        vec3 rock=mix(vec3(.090,.099,.099),vec3(.210,.177,.142),
                      clamp(.51+height*2.2+.18*sin(bed*2.3),0.,1.));
        float joints=turfNoise(soil*1.8);
        rock*=.89+.15*joints-.13*seam;
        vec3 ground=mix(turf,rock,smoothstep(.17,.76,planetBiome.z));
        // Sandy gravel occupies only the waterline, with a fine band of pale stone.
        float gravel=(1.-smoothstep(.003,.018,land));
        ground=mix(ground,vec3(.167,.167,.126),gravel);
        float aa=max(.001,fwidth(land)*.65);
        seaMask=1.-smoothstep(-aa,aa,land);
        float shoal=exp(min(0.,land)*49.);
        vec3 water=mix(vec3(.012,.065,.084),vec3(.056,.207,.185),shoal);
        if(seaMask>0.){
          vec2 wind=vec2(dot(planetMeters,vec3(.23,.04,.11)),dot(planetMeters,vec3(-.19,.72,.45)));
          float ripple=smoothstep(.66,.84,turfNoise(wind))*smoothstep(.28,.68,turfNoise(wind*.29));
          water+=vec3(.014,.030,.034)*ripple;
        }
        ground=mix(ground,water,seaMask);
        diffuseColor.rgb=mix(diffuseColor.rgb,ground,smoothstep(14.,36.,edge));
      }

    `,
        )
        .replace(
          "#include <opaque_fragment>",
          `
      #if NUM_DIR_LIGHTS > 0
        float terminator=smoothstep(-.50,.28,dot(normal,directionalLights[0].direction));
        // Planet-scale lighting starts beyond the flat parcel, including at night.
        float globe=smoothstep(2.,15.,edge);
        outgoingLight*=mix(vec3(1.),vec3(.41,.53,.65),(1.-terminator)*globe);
      #endif
      float limb=pow(1.-clamp(dot(normal, isOrthographic?vec3(0.,0.,1.):normalize(vViewPosition)),0.,1.),4.);
      outgoingLight+=vec3(.047,.129,.185)*smoothstep(2.,15.,edge)*limb*(.1+.9*airColor.g)*smoothstep(30.,110.,eyeDepth);
      float haze=1.-exp(-max(0.,eyeDepth-65.)*.0017);
      if(!isOrthographic) outgoingLight=mix(outgoingLight,airColor,haze*.65*smoothstep(2.,15.,edge));
      #include <opaque_fragment>
    `,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          roughnessFactor=mix(roughnessFactor,.28,seaMask);`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `
        #include <normal_fragment_maps>
        if(planetBiome.z>.17){
          vec3 facet=normalize(cross(dFdx(-vViewPosition),dFdy(-vViewPosition)));
          normal=normalize(mix(normal,facet,.68*smoothstep(.17,.8,planetBiome.z)));
        }
        if(hasDuff && coverage>.001){vec2 grainNormal=texture2D(duffNormal,debrisUv).rg*2.-1.;
          normal=normalize(normal+mat3(viewMatrix)*vec3(grainNormal.x,0.,-grainNormal.y)*coverage*.53);}
      `,
        );
    },
    [profile, settings, plot],
  );
  return (
    <meshStandardMaterial
      {...surface}
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
