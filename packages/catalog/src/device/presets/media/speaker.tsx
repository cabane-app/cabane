import { RoundedBox, ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector2, type Group } from "three";
import { palette, StatusBeacon } from "../../visuals/device-visual-state";
import { SpeakerGrille } from "./speaker-grille";

const profile = (pairs: number[][]) => pairs.map(([r, y]) => new Vector2(r, y));
const plinth = profile([
  [0, 0],
  [0.103, 0],
  [0.119, 0.007],
  [0.123, 0.018],
  [0.122, 0.028],
  [0.114, 0.034],
]);
const cloth = profile([
  [0.113, 0.027],
  [0.125, 0.037],
  [0.129, 0.05],
  [0.129, 0.319],
  [0.126, 0.331],
  [0.119, 0.337],
]);
const crown = profile([
  [0.118, 0.329],
  [0.13, 0.337],
  [0.13, 0.348],
  [0.123, 0.359],
  [0.108, 0.367],
  [0.098, 0.37],
  [0, 0.37],
]);

export function SpeakerModel({ visualState, reducedMotion }: HomeDeviceModelProps) {
  const active = visualState === "connected-active";
  const soundBands = useRef<Group>(null);
  useFrame(({ clock, invalidate }) => {
    if (!soundBands.current) return;
    const pulse = active && !reducedMotion ? 1 + 0.16 * Math.sin(clock.elapsedTime * 6) : 1;
    soundBands.current.scale.set(pulse, 1, 1);
    if (active && !reducedMotion) invalidate();
  });
  return (
    <group name="catalog-speaker">
      <mesh castShadow receiveShadow>
        <latheGeometry args={[plinth, 32]} />
        <ToonMaterial color="#37433e" />
      </mesh>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[cloth, 48]} />
        <ToonMaterial color={palette.charcoal} />
      </mesh>
      <SpeakerGrille />
      <mesh castShadow receiveShadow>
        <latheGeometry args={[crown, 32]} />
        <ToonMaterial color={palette.bodyDark} />
      </mesh>
      <mesh position={[0, 0.369, 0]}>
        <cylinderGeometry args={[0.084, 0.092, 0.006, 32]} />
        <ToonMaterial color={palette.body} />
      </mesh>
      <RoundedBox
        args={[0.08, 0.186, 0.015]}
        radius={0.006}
        bevelSegments={1}
        smoothness={1}
        position={[0, 0.19, 0.1222]}
      >
        <ToonMaterial color="#384541" />
      </RoundedBox>
      <group ref={soundBands} name="speaker-sound-bands" position={[0, 0.19, 0.13]}>
        {[0.035, 0.054, 0.044, 0.029].map((width, i) => (
          <mesh key={width} position={[0, (i - 1.5) * 0.032, 0]}>
            <planeGeometry args={[width, 0.005]} />
            <ToonMaterial color={active ? palette.coral : palette.bodyDark} />
          </mesh>
        ))}
      </group>
      <mesh position={[-0.05, 0.372, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.029, 20]} />
        <ToonMaterial color="#616f69" />
      </mesh>
      <StatusBeacon visualState={visualState} position={[0, 0.374, 0]} scale={0.85} />
    </group>
  );
}
