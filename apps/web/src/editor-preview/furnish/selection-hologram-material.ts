import type { LineMaterial } from "three-stdlib";

const selectionStroke =
  (glow: boolean): LineMaterial["onBeforeCompile"] =>
  (shader) => {
    shader.vertexShader = `varying float vEdgeVisibility;\n${shader.vertexShader}`.replace(
      "void main() {",
      `void main() {
      // An edge stays bright when either adjacent face looks toward the editor camera.
      vec3 midpoint = (instanceStart + instanceEnd) * 0.5;
      vec3 facing = sign(midpoint) * vec3(
        modelViewMatrix[0].z, modelViewMatrix[1].z, modelViewMatrix[2].z);
      vEdgeVisibility = max(max(facing.x, facing.y), facing.z) > 0.001 ? 1.0 : 0.22;`,
    );
    shader.fragmentShader = `varying float vEdgeVisibility;\n${shader.fragmentShader}`.replace(
      "vec4 diffuseColor = vec4( diffuse, alpha );",
      `${
        glow
          ? `float cap = max(abs(vUv.y) - 1.0, 0.0);
        float radius = length(vec2(vUv.x, cap));
        alpha *= exp(-4.5 * radius * radius) * (1.0 - smoothstep(0.8, 1.0, radius));`
          : ""
      }
      vec4 diffuseColor = vec4(diffuse * ${glow ? "1.5" : "2.5"}, alpha * vEdgeVisibility);`,
    );
  };

/** Fade across the stroke and its round caps without a bloom render pass. */
export const compileSelectionGlow = selectionStroke(true);
export const compileSelectionEdge = selectionStroke(false);

export const selectionScanVertexShader = /* glsl */ `
  varying float vHeight;
  varying float vVertical;
  void main() {
    vHeight = position.y;
    vVertical = 1.0 - abs(normal.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const selectionScanFragmentShader = /* glsl */ `
  uniform float phase;
  uniform float enabled;
  varying float vHeight;
  varying float vVertical;
  void main() {
    // Travel beyond the box at both ends so each sweep enters and leaves softly.
    float distance = abs(vHeight - mix(-0.65, 0.65, phase));
    float band = exp(-pow(distance / 0.045, 2.0));
    float line = 1.0 - smoothstep(0.0, max(fwidth(vHeight) * 1.5, 0.002), distance);
    float alpha = (band * 0.035 + line * 0.10) * enabled * vVertical;
    gl_FragColor = vec4(0.0, 0.92, 1.0, alpha);
    #include <colorspace_fragment>
  }
`;
