export const contourFragmentShader = /* glsl */ `
  uniform bool simsStyle;
  uniform float inkStrength;
  uniform sampler2D beauty;
  uniform sampler2D importedDepth;
  uniform bool hasImportedModels;
  uniform sampler2D sceneDepth;
  uniform vec2 texel;
  uniform float nearPlane;
  uniform float farPlane;
  uniform bool perspective;
  uniform vec3 ink;
  varying vec2 vUv;
  #include <packing>
  float distanceAt(vec2 uv) {
    float d = texture2D(sceneDepth, uv).x;
    return perspective ? -perspectiveDepthToViewZ(d, nearPlane, farPlane)
                       : -orthographicDepthToViewZ(d, nearPlane, farPlane);
  }
  void main() {
    vec4 surface = texture2D(beauty, vUv);
    float center = distanceAt(vUv);
    vec2 dx = vec2(texel.x, 0.0), dy = vec2(0.0, texel.y);
    float left = distanceAt(vUv - dx), right = distanceAt(vUv + dx);
    float down = distanceAt(vUv - dy), up = distanceAt(vUv + dy);
    // Subtract the opposite slope to exclude coplanar and continuously slanted faces.
    float jump = max(max(right - center - abs(center - left), left - center - abs(center - right)),
                     max(up - center - abs(center - down), down - center - abs(center - up)));
    float threshold = max(0.075, center * 0.004);
    float edge = smoothstep(threshold, threshold * 2.0, jump);
    if (hasImportedModels && abs(texture2D(importedDepth, vUv).x - texture2D(sceneDepth, vUv).x) < 0.000001) edge = 0.0;
    vec3 shadedInk = mix(surface.rgb * 0.42, ink, 0.35);
    vec3 color = mix(surface.rgb, shadedInk, edge * (simsStyle ? 0.0 : inkStrength));
    if (simsStyle) {
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = max(vec3(0.0), mix(vec3(luminance), color, 1.12));

    }
    gl_FragColor = vec4(color, surface.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
