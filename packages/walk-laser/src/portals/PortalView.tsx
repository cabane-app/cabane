import { useMemo } from "react";
import type { PortalAnchor } from "./portal-contract";
import { usePortalView } from "./usePortalView";

/** Projective sampling preserves perspective as the viewer moves past the oval. */
export function PortalView({ entry, exit }: { entry: PortalAnchor; exit: PortalAnchor }) {
  const { surface, texture, screenRect } = usePortalView(entry, exit);
  const uniforms = useMemo(
    () => ({ destination: { value: texture }, screenRect: { value: screenRect } }),
    [texture, screenRect],
  );
  return (
    <mesh
      ref={surface}
      name="portal-live-view"
      userData={{ portalLiveView: true }}
      position={[0, 0, 0.002]}
      raycast={() => undefined}
    >
      <circleGeometry args={[1, 64]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`varying vec4 portalClip;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          portalClip = gl_Position;
        }`}
        fragmentShader={`uniform sampler2D destination;
        uniform vec4 screenRect;
        varying vec4 portalClip;
        void main() {
          vec2 screenUv = portalClip.xy / portalClip.w * 0.5 + 0.5;
          vec2 uv = (screenUv - screenRect.xy) / screenRect.zw;
          gl_FragColor = vec4(texture2D(destination, uv).rgb, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`}
      />
    </mesh>
  );
}
