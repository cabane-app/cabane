import { RoundedBox, ToonMaterial } from "@cabane/engine";
import { linenWeaveTexture } from "../../construction/linen-weave-texture";

export function PillowNest() {
  return (
    <group name="reading-pillow-nest">
      {[-0.217, 0.217].map((x, i) => (
        <RoundedBox
          key={x}
          args={[0.49, 0.18, 0.4]}
          radius={0.084}
          smoothness={2}
          bevelSegments={2}
          position={[x, 0.535, -0.86]}
          rotation={[0.26, i === 0 ? -0.09 : 0.09, 0]}
          castShadow
        >
          <ToonMaterial color={i === 0 ? "#d1ac97" : "#efcca9"} map={linenWeaveTexture} />
        </RoundedBox>
      ))}
      <group name="chamomile-cushion" position={[0, 0.59, -0.632]} rotation={[-0.32, 0, -0.14]}>
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i * Math.PI * 2) / 7;
          return (
            <mesh
              key={i}
              position={[-0.105 * Math.sin(a), 0.105 * Math.cos(a), 0]}
              rotation={[0, 0, a]}
              scale={[0.071, 0.104, 0.055]}
              castShadow
            >
              <sphereGeometry args={[1, 12, 8]} />
              <ToonMaterial color="#fff2d6" map={linenWeaveTexture} />
            </mesh>
          );
        })}
        <mesh position={[0, 0, 0.036]} scale={[0.077, 0.077, 0.05]} castShadow>
          <sphereGeometry args={[1, 14, 8]} />
          <ToonMaterial color="#dba653" map={linenWeaveTexture} />
        </mesh>
      </group>
    </group>
  );
}
