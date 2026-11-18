import { useMemo, useSyncExternalStore } from "react";
import { ClampToEdgeWrapping, SRGBColorSpace, type Texture } from "three";
import { scan } from "../scanned-finishes";
import cloudUrl from "./assets/day-sky.webp?url";
import starsUrl from "./assets/night-sky.webp?url";
const clamp = (t: Texture) => {
  t.wrapT = ClampToEdgeWrapping;
};
const sky = scan(cloudUrl, 1, SRGBColorSpace, clamp),
  stars = scan(starsUrl, 1, SRGBColorSpace, clamp);
const none = () => null,
  idle = { subscribe: () => () => {}, snapshot: none };
const vertex = /* glsl */ `
varying vec3 ray;
void main(){
 vec3 view=(inverse(projectionMatrix)*vec4(position.xy,0.,1.)).xyz;
 ray=transpose(mat3(viewMatrix))*view;
 gl_Position=vec4(position.xy,.999999,1.);
}`;
const fragment = /* glsl */ `
uniform sampler2D clouds,stars;
uniform float daylight,overcast;
uniform bool hasStars;
varying vec3 ray;
void main(){
 vec3 dir=normalize(ray);
 vec2 uv=vec2(.57+atan(dir.z,dir.x)/6.283185,asin(clamp(dir.y,0.,1.))/1.570796);
 vec3 day=texture2D(clouds,uv).rgb;
 float luma=dot(day,vec3(.21,.72,.07));
 day=mix(day,vec3(luma)*vec3(.87,.95,1.05),.7*overcast)*(1.-.39*overcast);
 vec3 night=mix(vec3(.043,.054,.079),vec3(.007,.014,.034),smoothstep(0.,.5,uv.y));
 if(hasStars)night+=max(texture2D(stars,uv).rgb-.025,0.)*vec3(.4,.49,.66)*(.035+.965*smoothstep(.016,.57,dir.y))*(1.-overcast);
 gl_FragColor=vec4(mix(night,day,daylight),1.);
 #include <colorspace_fragment>
}`;
export function CountrySky({ daylight, overcast }: { daylight: number; overcast: number }) {
  const clouds = useSyncExternalStore(sky.subscribe, sky.snapshot, none);
  const source = daylight < 1 ? stars : idle;
  const night = useSyncExternalStore(source.subscribe, source.snapshot, none);
  const uniforms = useMemo(
    () => ({
      clouds: { value: clouds },
      stars: { value: night },
      daylight: { value: daylight },
      overcast: { value: overcast },
      hasStars: { value: Boolean(night) },
    }),
    [clouds, night, daylight, overcast],
  );
  return (
    clouds && (
      <mesh name="country-sky" frustumCulled={false} renderOrder={-990} raycast={() => {}}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          uniforms={uniforms}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          vertexShader={vertex}
          fragmentShader={fragment}
        />
      </mesh>
    )
  );
}
