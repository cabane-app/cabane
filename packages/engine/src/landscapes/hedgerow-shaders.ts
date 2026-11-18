import { countryDepth } from "./country-survey";
export const canopyVertex = /* glsl */ `
uniform sampler2D samples, heights;
uniform vec2 lotCenter,halfLot;
uniform vec4 gradeBounds,gradeCorners;
uniform float scaleMeters, seconds;
varying vec2 leafUv;
varying float light, eyeDepth;
float hash(float n) { return fract(sin(mod(n,653.) * 21.173) * 43758.54); }
void main() {
  // Each canopy sample is paired with its tree root in the right half of the map.
  int width=textureSize(samples,0).x/2;
  ivec2 pixel=ivec2(gl_InstanceID % width,gl_InstanceID/width);
  vec4 s=texelFetch(samples,pixel,0);
  vec3 root=texelFetch(samples,pixel+ivec2(width,0),0).rgb;
  vec2 stem=(root.rg-.5)*384.*scaleMeters;
  vec2 stemClearance=abs(stem-lotCenter)-halfLot;
  float seed=float(gl_InstanceID);
  vec2 survey=(s.rg-.5)*384.+(vec2(hash(seed),hash(seed+83.))-.5)*1.48;
  vec2 field=survey*scaleMeters;
  vec2 toEdge=abs(field-lotCenter)-halfLot;
  float edge=max(toEdge.x,toEdge.y);
  if(s.a<.001 || max(stemClearance.x,stemClearance.y)<1.4 || edge<-.2){gl_Position=vec4(2.,2.,2.,1.);return;}
  float soil=texture2D(heights,vec2(.5+survey.x/384.,.5-survey.y/384.)).r*20.-8.09;
  vec2 g=smoothstep(gradeBounds.xy,gradeBounds.zw,field);
  float grade=mix(mix(gradeCorners.x,gradeCorners.y,g.x),mix(gradeCorners.z,gradeCorners.w,g.x),g.y);
  float base=mix(grade,soil*scaleMeters,smoothstep(0.,max(12.,17.*scaleMeters),edge));
  float measuredHeight=max(.25,s.b*45.-8.09-soil);
  // Preserve low shrubs, and let light and views through under the mature crowns.
  float treeHeight=root.b*35.;
  float skirt=smoothstep(3.,9.,treeHeight)*treeHeight*(.20+.08*hash(seed+11.));
  if(measuredHeight<skirt){gl_Position=vec4(2.,2.,2.,1.);return;}
  float crown=base+measuredHeight*scaleMeters;
  float yaw=hash(seed+15.)*6.28318;
  vec3 right=vec3(cos(yaw),0.,sin(yaw)), forward=vec3(-sin(yaw),0.,cos(yaw));
  float size=(3.4+hash(seed+7.)*1.8)*(1.+smoothstep(68.,136.,length(survey))*.60)*scaleMeters;
  float arch=1.-4.*position.y*position.y;
  vec3 arm=right*position.x + forward*position.y*(.64+.3*hash(seed+67.));
  arm.y=position.y*(hash(seed+2.)*1.8-.9)+arch*.22;
  // Individual limbs keep their world orientation when the player turns or walks.
  arm.x+=.022*position.y*sin(seconds*1.17+field.x*.31+field.y*.17);
  vec4 mvPosition=modelViewMatrix*vec4(vec3(field.x,crown,field.y)+arm*size,1.);
  eyeDepth=-mvPosition.z;
  light=s.a;
  leafUv=vec2(uv.x*.5+step(.5,hash(seed+5.))*.5,uv.y);
  gl_Position=projectionMatrix*mvPosition;
  ${countryDepth}
}`;
export const canopyFragment = /* glsl */ `
uniform sampler2D sprays;
uniform float daylight,overcast;
varying vec2 leafUv;
varying float light,eyeDepth;
void main(){
  vec4 twig=texture2D(sprays,leafUv);
  if(twig.a<.30) discard;
  vec3 day=twig.rgb*mix(vec3(.13,.20,.14),vec3(.74,.89,.65),light*light);
  float luma=dot(day,vec3(.2126,.7152,.0722));
  vec3 night=vec3(.0014,.0027,.0045)+luma*vec3(.19,.29,.36)+day*.053;
  vec3 air=mix(vec3(.052,.070,.10),vec3(.47,.59,.68),daylight);
  float haze=(1.-exp(-max(0.,eyeDepth-65.)*.0017))*.83;
  gl_FragColor=vec4(mix(mix(night,day*(1.-.39*overcast),daylight),air,haze),1.);
  #include <colorspace_fragment>
}`;
