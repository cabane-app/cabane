import { ShaderChunk } from "three";

const pointLightInfo = "getPointLightInfo( pointLight, geometryPosition, directLight );";
const directLightContribution =
  "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );";

const householdShadow = `
#if NUM_POINT_LIGHTS > 0
  precision highp sampler2DShadow;
  uniform sampler2DShadow cabaneShadowAtlas;
  uniform float cabaneShadowFaceSize;
  uniform int cabanePointLightCount;
  uniform vec4 cabanePointShadows[ NUM_POINT_LIGHTS ];

  // The face order and projection match the native Three PointLight shadow camera.
  float cabaneSamplePointShadow(vec3 ray, vec4 entry) {
    vec3 a = abs(ray);
    float depth = max(max(a.x, a.y), a.z);
    if (depth < entry.z || depth > entry.w) return 1.0;
    vec2 uv;
    int face;
    if (a.x >= max(a.y, a.z)) {
      face = ray.x > 0.0 ? 0 : 1;
      uv = vec2(ray.x > 0.0 ? -ray.z : ray.z, -ray.y);
    } else if (a.y >= a.z) {
      face = ray.y > 0.0 ? 2 : 3;
      uv = vec2(ray.x, ray.y > 0.0 ? ray.z : -ray.z);
    } else {
      face = ray.z > 0.0 ? 4 : 5;
      uv = vec2(ray.z > 0.0 ? ray.x : -ray.x, -ray.y);
    }
    // Clamp the bilinear footprint to the tile so unrelated faces cannot bleed.
    uv = clamp((uv / depth * 0.5 + 0.5) * cabaneShadowFaceSize,
      vec2(0.5), vec2(cabaneShadowFaceSize - 0.5));
    vec2 tile = entry.xy + vec2(float(face % 3), float(face / 3));
    vec2 atlasUv = (tile * cabaneShadowFaceSize + uv) / vec2(textureSize(cabaneShadowAtlas, 0));
    float comparison = entry.w * (depth - entry.z) / (depth * (entry.w - entry.z));
    return texture(cabaneShadowAtlas, vec3(atlasUv, comparison - 0.000005));
  }
#endif
`;

// Preserve Three's light models and non-household shadows. Off or pending
// lamps retain their uniform slots and skip the whole direct-light evaluation.
const pointLighting = ShaderChunk.lights_fragment_begin
  .replace(
    pointLightInfo,
    `if (pointLight.color != vec3(0.0) && cabanePointShadows[ i ].x > -2.0) {
        vec4 cabaneShadowEntry = cabanePointShadows[ i ];
        ${pointLightInfo}
        if (directLight.visible) {
        if (receiveShadow && cabaneShadowEntry.x >= 0.0) {
          vec3 ray = transpose(mat3(viewMatrix)) * (geometryPosition - pointLight.position + geometryNormal * 0.005);
          directLight.color *= cabaneSamplePointShadow(ray, cabaneShadowEntry);
        }`,
  )
  .replace(directLightContribution, `${directLightContribution}\n    }\n    }`);

// Only native cube sampler arrays need literal indices. Keep the common
// atlas path in a single loop even on floors with dozens of point sources.
const pointStart = pointLighting.indexOf("#if ( NUM_POINT_LIGHTS > 0 )");
const spotStart = pointLighting.indexOf("#if ( NUM_SPOT_LIGHTS > 0 )");
const pointBlock = pointLighting.slice(pointStart, spotStart);
const atlasLighting =
  pointLighting.slice(0, pointStart) +
  "#if NUM_POINT_LIGHT_SHADOWS > 0\n" +
  pointBlock +
  "#else\n" +
  pointBlock
    .replace(/#pragma unroll_loop_(start|end)/g, "")
    .replace("i < NUM_POINT_LIGHTS", "i < cabanePointLightCount")
    .replace(/#if defined\( USE_SHADOWMAP \)[\s\S]*?#endif/g, "") +
  "#endif\n" +
  pointLighting.slice(spotStart);

export function addPointShadowSampling(fragmentShader: string) {
  return (householdShadow + fragmentShader).replace(
    "#include <lights_fragment_begin>",
    atlasLighting,
  );
}
