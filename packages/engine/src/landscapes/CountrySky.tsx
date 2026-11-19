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
 if(projectionMatrix[3][3]>.5) view=vec3(position.x*.57*projectionMatrix[1][1]/projectionMatrix[0][0],position.y*.57,-1.);
 ray=transpose(mat3(viewMatrix))*view;
 gl_Position=vec4(position.xy,.999999,1.);
}`;
const fragment = /* glsl */ `
uniform sampler2D clouds,stars;
uniform float daylight,overcast;
uniform bool hasStars,orbit;
varying vec3 ray;
float hash(vec2 cell) {
 vec3 h=fract(cell.xyx*vec3(.1031,.1030,.0973));
 h+=dot(h,h.yzx+33.33);
 return fract((h.x+h.y)*h.z);
}
vec3 starlight(vec3 dir) {
 vec3 a=abs(dir);
 vec2 face=a.x>max(a.y,a.z)?dir.yz/a.x+sign(dir.x)*3.:
           a.y>a.z?dir.zx/a.y+sign(dir.y)*7.:dir.xy/a.z+sign(dir.z)*11.;
 vec2 grid=face*75.;
 vec2 cell=floor(grid);
 float seed=hash(cell);
 vec2 delta=fract(grid)-(.19+.62*vec2(hash(cell+19.),hash(cell-41.)));
 vec2 pixel=max(fwidth(grid),.001);
 float size=mix(.45,1.3,pow(seed,8.));
 float core=1.-smoothstep(size*.25,size+.55,length(delta/pixel));
 return mix(vec3(.54,.69,1.),vec3(1.,.82,.67),hash(cell+53.))*core*step(.82,seed)*(.07+.62*pow(seed,14.));
}
void main(){
 vec3 dir=normalize(ray);
 if(orbit){
   vec2 skyUv=vec2(.57+atan(dir.z,dir.x)/6.283185,.5+asin(clamp(dir.y,-1.,1.))/3.141593);
   vec3 dust=hasStars?texture2D(stars,skyUv,4.).rgb:vec3(0.);
   vec3 space=mix(vec3(.009,.018,.038),vec3(.030,.058,.085),smoothstep(-.65,.8,dir.x*.74+dir.z*.5));
   gl_FragColor=vec4(space+max(dust-.026,0.)*.085+starlight(dir),1.);
 } else {
 vec2 uv=vec2(.57+atan(dir.z,dir.x)/6.283185,asin(clamp(dir.y,0.,1.))/1.570796);
 vec3 day=texture2D(clouds,uv).rgb;
 day=mix(day,vec3(.26,.38,.49),smoothstep(0.,.34,-dir.y));
 float luma=dot(day,vec3(.21,.72,.07));
 day=mix(day,vec3(luma)*vec3(.87,.95,1.05),.7*overcast)*(1.-.39*overcast);
 vec3 night=mix(vec3(.043,.054,.079),vec3(.007,.014,.034),smoothstep(0.,.5,uv.y));
 if(hasStars)night+=max(texture2D(stars,uv).rgb-.025,0.)*vec3(.4,.49,.66)*(.035+.965*smoothstep(.016,.57,dir.y))*(1.-overcast);
 gl_FragColor=vec4(mix(night,day,daylight),1.);
 }
 #include <colorspace_fragment>
}`;
export function CountrySky({
  daylight,
  overcast,
  orbit,
}: {
  daylight: number;
  overcast: number;
  orbit: boolean;
}) {
  const daySource = orbit ? idle : sky;
  const clouds = useSyncExternalStore(daySource.subscribe, daySource.snapshot, none);
  const source = orbit || daylight < 1 ? stars : idle;
  const night = useSyncExternalStore(source.subscribe, source.snapshot, none);
  const uniforms = useMemo(
    () => ({
      orbit: { value: orbit },
      clouds: { value: clouds },
      stars: { value: night },
      daylight: { value: daylight },
      overcast: { value: overcast },
      hasStars: { value: Boolean(night) },
    }),
    [clouds, night, daylight, overcast, orbit],
  );
  return (
    (orbit || clouds) && (
      <mesh name="country-sky" frustumCulled={false} renderOrder={990} raycast={() => {}}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          uniforms={uniforms}
          depthWrite={false}
          depthTest
          toneMapped={false}
          vertexShader={vertex}
          fragmentShader={fragment}
        />
      </mesh>
    )
  );
}
