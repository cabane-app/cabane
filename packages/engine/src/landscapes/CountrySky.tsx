import { useMemo, useSyncExternalStore } from "react";
import { Vector4 } from "three";
import { planetDimensions } from "./landscape-frame";
import type { FieldPlot } from "./country-survey";
import { planetScans } from "./planet-scans";
const { daySky, nightSky } = planetScans;
const none = () => null;
const vertex = /* glsl */ `
uniform vec4 planet;
varying vec2 limbPoint;
varying vec3 ray;
void main(){
 vec3 view=(inverse(projectionMatrix)*vec4(position.xy,0.,1.)).xyz;
 limbPoint=(view.xy-(modelViewMatrix*vec4(planet.xyz,1.)).xy)/planet.w;
 if(projectionMatrix[3][3]>.5) view=vec3(position.x*.57*projectionMatrix[1][1]/projectionMatrix[0][0],position.y*.57,-1.);
 ray=transpose(mat3(viewMatrix))*view;
 gl_Position=vec4(position.xy,.999999,1.);
}`;
const fragment = /* glsl */ `
uniform sampler2D clouds,stars;
uniform float daylight,overcast;
uniform bool hasClouds,hasStars,orbit;
varying vec2 limbPoint;
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
 return mix(vec3(.54,.69,1.),vec3(1.,.82,.67),hash(cell+53.))*core*step(.925,seed)*(.07+.62*pow(seed,14.));
}
void main(){
 vec3 dir=normalize(ray);
 if(orbit){
   float altitude=max(0.,length(limbPoint)-1.);
   vec3 sunView=mat3(viewMatrix)*normalize(vec3(-.65,.86,.45));
   float lit=.22+.78*smoothstep(-.65,.92,dot(limbPoint,sunView.xy));
   float halo=exp(-26.*altitude)*lit*(.25+.75*daylight);
   vec3 space=vec3(.0022,.0043,.009);
   gl_FragColor=vec4(space+vec3(.036,.084,.15)*halo+starlight(dir),1.);
 } else {
 vec2 uv=vec2(.57+atan(dir.z,dir.x)/6.283185,asin(clamp(dir.y,0.,1.))/1.570796);
 // Adjacent rays can cross atan's longitude seam. Use their shortest wrapped
 // distance so the panorama keeps the same mip level on both sides.
 vec2 dx=dFdx(uv),dy=dFdy(uv);
 dx.x-=round(dx.x);
 dy.x-=round(dy.x);
 vec3 day=hasClouds?textureGrad(clouds,uv,dx,dy).rgb:
    mix(vec3(.52,.64,.72),vec3(.18,.37,.59),smoothstep(0.,.75,dir.y));
 day=mix(day,vec3(.26,.38,.49),smoothstep(0.,.34,-dir.y));
 float luma=dot(day,vec3(.21,.72,.07));
 day=mix(day,vec3(luma)*vec3(.87,.95,1.05),.7*overcast)*(1.-.39*overcast);
 vec3 night=mix(vec3(.043,.054,.079),vec3(.007,.014,.034),smoothstep(0.,.5,uv.y));
 if(hasStars)night+=max(textureGrad(stars,uv,dx,dy).rgb-.025,0.)*vec3(.4,.49,.66)*(.035+.965*smoothstep(.016,.57,dir.y))*(1.-overcast);
 gl_FragColor=vec4(mix(night,day,daylight),1.);
 }
 #include <colorspace_fragment>
}`;
export function CountrySky({
  plot,
  daylight,
  overcast,
  orbit,
}: {
  plot: FieldPlot;
  daylight: number;
  overcast: number;
  orbit: boolean;
}) {
  const clouds = useSyncExternalStore(daySky.subscribe, daySky.snapshot, none);
  const night = useSyncExternalStore(nightSky.subscribe, nightSky.snapshot, none);
  const globe = useMemo(() => {
    const lot = plot.plantingLot;
    const { radius, centerDepth } = planetDimensions(lot);
    return new Vector4(
      lot.centerX - plot.surveyX,
      -centerDepth,
      lot.centerZ - plot.surveyZ,
      radius,
    );
  }, [plot]);
  const uniforms = useMemo(
    () => ({
      planet: { value: globe },
      orbit: { value: orbit },
      clouds: { value: clouds },
      stars: { value: night },
      daylight: { value: daylight },
      overcast: { value: overcast },
      hasClouds: { value: Boolean(clouds) },
      hasStars: { value: Boolean(night) },
    }),
    [clouds, night, daylight, overcast, orbit, globe],
  );
  return (
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
  );
}
