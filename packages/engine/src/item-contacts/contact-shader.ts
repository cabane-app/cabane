export const contactVertex = /* glsl */ `
  attribute vec4 contact;
  varying vec2 floorPoint;
  flat varying vec4 vContact;
  void main() {
    floorPoint = position.xz;
    vContact = contact;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const contactFragment = /* glsl */ `
  uniform highp sampler2D outlines;
  varying vec2 floorPoint;
  flat varying vec4 vContact;
  void main() {
    float distanceSquared = vContact.z * vContact.z;
    bool inside = true;
    int width = textureSize(outlines, 0).x;
    int first = int(vContact.x);
    for (int i = 0; i < int(vContact.y); i++) {
      int segment = first + i;
      vec4 edge = texelFetch(outlines, ivec2(segment % width, segment / width), 0);
      vec2 relative = floorPoint - edge.xy;
      float t = clamp(dot(relative, edge.zw) / max(dot(edge.zw, edge.zw), 1e-12), 0.0, 1.0);
      vec2 delta = relative - t * edge.zw;
      distanceSquared = min(distanceSquared, dot(delta, delta));
      inside = inside && (edge.z * relative.y - edge.w * relative.x >= 0.0);
    }
    float radius = inside ? 0.0 : sqrt(distanceSquared) / vContact.z;
    float falloff = radius < 0.32 ? mix(1.0, 0.43, radius / 0.32)
                                  : 0.43 * (1.0 - radius) / 0.68;
    gl_FragColor = vec4(0.0, 0.0, 0.0, vContact.w * falloff);
  }
`;
