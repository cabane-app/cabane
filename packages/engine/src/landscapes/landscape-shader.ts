import { shadeExtent } from "./ground-shade";

// The scenery has its own finite depth interval at the back of the scene.
// Moving the Walk camera still gives full perspective and parallax. The home
// keeps its normal camera range, picking surfaces, shadow budget and contours.
export const landscapeVertex = /* glsl */ `
attribute float surface;
attribute vec4 foliage;
varying vec3 local;
varying vec3 face;
varying vec3 pigment;
varying float kind;
varying vec2 atlasUv;
varying float viewDistance;
void main() {
  local = position;
  face = normal;
  pigment = color;
  kind = surface;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  atlasUv = foliage.xy;
  if(surface > 5.5) {
    // Keep the feet planted and rotate the illustrated canopy into view.
    view.xy += foliage.zw * length(modelMatrix[0].xyz);
  }
  viewDistance = -view.z;
  // Compress the backdrop around the site in the orthographic model view.
  // In Walk it retains its metre scale and perspective.
  if(projectionMatrix[3][3] > 0.5) {
    vec4 origin = modelViewMatrix * vec4(0.,0.,0.,1.);
    view.xy = mix(origin.xy,view.xy,0.48);
  }
  gl_Position = projectionMatrix * view;
  gl_Position.z = 0.9998 * gl_Position.w;
}`;

export const landscapeFragment = /* glsl */ `
uniform sampler2D leaves;
uniform sampler2D brick;
uniform sampler2D shadeMap;
uniform bool hasBrick;
uniform vec3 sun;
uniform float daylight;
uniform float overcast;
varying vec3 local;
varying vec3 face;
varying vec3 pigment;
varying float kind;
varying vec2 atlasUv;
varying float viewDistance;
float hash(vec2 p) { return fract(sin(mod(dot(p, vec2(41.71, 113.53)), 6.283185)) * 4375.53); }
void main() {
  if(viewDistance <= 0.0) discard;
  vec3 n = normalize(face);
  vec3 albedo = pigment;
  vec3 emission = vec3(0.0);
  if (kind > 1.5 && kind < 3.5 && abs(n.y) < 0.4) {
    bool glass = kind > 2.5;
    vec2 meters = vec2(abs(n.x) > 0.5 ? local.z : local.x, local.y);
    vec2 uv = meters / vec2(glass ? 1.28 : 1.87, 2.65);
    vec2 cell = floor(uv);
    vec2 f = fract(uv);
    vec2 aa = min(fwidth(uv), vec2(0.24));
    vec2 inset = glass ? vec2(0.055, 0.15) : vec2(0.23, 0.23);
    vec2 pane = smoothstep(inset-aa, inset+aa, f) * (1.0-smoothstep(1.0-inset-aa, 1.0-inset+aa, f));
    float salt = dot(n.xz, local.xz);
    float variation = hash(cell + floor(salt) * 1.73);
    float sill = 1.0 - smoothstep(0.02, 0.055 + aa.y, abs(f.y - 0.21));
    albedo += (glass ? 0.012 : 0.06) * pane.x * sill;
    vec3 windowColor = mix(vec3(0.075,0.113,0.135),vec3(0.26,0.33,0.35),variation);
    float sash = 1.0-smoothstep(0.014, 0.035+aa.y,abs(f.y-0.55));
    albedo = mix(albedo, windowColor * (1.0 - 0.38 * sash), pane.x * pane.y);
    if(!glass && hasBrick) {
      vec3 bay = texture2D(brick,uv).rgb;
      albedo = bay * mix(vec3(1.0), pigment / vec3(0.30,0.14,0.081), 0.65);
      // The glass opening is inset from the illustrated limestone casing.
      pane = smoothstep(vec2(0.30,0.275)-aa,vec2(0.30,0.275)+aa,f) *
             (1.0-smoothstep(vec2(0.68,0.735)-aa,vec2(0.68,0.735)+aa,f));
      albedo *= 1.0 + pane.x * pane.y * (variation-0.5)*0.68;
    }
    emission = vec3(0.95,0.57,0.24) * pane.x * pane.y * step(0.76, variation) * pow(1.0-daylight, 1.5) * (0.46 + 0.4 * variation);
  } else if (abs(kind-5.0)<0.1 && n.y>0.9) {
    vec2 square = abs(fract(local.xz / 1.65)-0.5);
    albedo *= 1.0 - 0.09 * smoothstep(0.466, 0.5, max(square.x,square.y)) * (1.0-smoothstep(0.08,0.28,fwidth(local.x)));
  } else if (abs(kind-4.0)<0.1 && n.y>0.9) {
    vec2 street = abs(mod(local.xz + vec2(16.0,13.5), vec2(32.0,27.0))-vec2(16.0,13.5));
    float stripe = (1.0-smoothstep(0.04,0.14,16.0-street.x)) * step(0.45,fract(local.z/5.0));
    albedo = mix(albedo, vec3(0.52,0.40,0.20), stripe * 0.62);
    float crosswalk = step(10.6,street.x)*step(street.x,12.5)*step(10.5,street.y)*step(0.42,fract(local.z/0.84));
    crosswalk += step(7.9,street.y)*step(street.y,9.75)*step(13.0,street.x)*step(0.42,fract(local.x/0.84));
    albedo = mix(albedo,vec3(0.57,0.55,0.49),min(1.0,crosswalk)*0.78);
  }
  if(kind > 5.5) {
    vec4 plant = texture2D(leaves,atlasUv);
    if(plant.a < 0.36) discard;
    if(atlasUv.y < 0.034 && atlasUv.y * 30.0 < hash(floor(atlasUv*480.))) discard;
    albedo *= plant.rgb * mix(0.73,1.0,smoothstep(0.0,0.5,atlasUv.y));
  }
  // Interpolate eye distance before compressing it. Compressing at vertices
  // makes large ground triangles incorrectly cover sidewalks and roofs.
  float d = max(viewDistance, 0.0);
  gl_FragDepth = 0.99985 + 0.000145 * d / (d + 75.0);
  float key = max(dot(n, normalize(sun)), 0.0);
  float sky = n.y * 0.5 + 0.5;
  vec3 lighting = mix(vec3(0.10,0.15,0.23),vec3(0.60,0.70,0.74),daylight) * (0.58 + sky * 0.42);
  lighting += vec3(0.93,0.80,0.60) * key * daylight * (1.0 - 0.74 * overcast);
  if ((abs(kind-4.0)<0.1 || abs(kind-5.0)<0.1) && n.y > 0.5) {
    float shade = texture2D(shadeMap,local.xz / ${shadeExtent.toFixed(1)} + 0.5).r;
    lighting *= 1.0 - shade * 0.43;
  }
  vec3 lit = albedo * lighting + emission;
  vec3 haze = mix(vec3(0.036,0.059,0.094), vec3(0.66,0.72,0.69), daylight);
  float distanceHaze = smoothstep(22.0,195.0,length(local.xz)) * (0.74 + 0.20 * overcast);
  gl_FragColor = vec4(mix(lit,haze,distanceHaze), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
