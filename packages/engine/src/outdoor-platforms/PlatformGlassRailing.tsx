import { DoubleSide } from "three";
import { ToonMaterial } from "../rendering";
import { PlatformRailingMember } from "./PlatformRailingMember";

export function PlatformGlassRailing({
  length,
  height,
  name = "glass-railing",
}: {
  length: number;
  height: number;
  name?: string | undefined;
}) {
  const panelCount = Math.ceil(length / 1.3);
  const postWidth = Math.min(0.035, length / 4);
  const postSpacing = (length - postWidth) / panelCount;
  const capHeight = Math.min(0.035, height * 0.12);
  const baseClearance = Math.min(0.055, height * 0.12);
  const glassHeight = height - capHeight - baseClearance;
  const firstPost = (postWidth - length) / 2;

  return (
    <>
      <PlatformRailingMember
        name={`${name}-cap`}
        at={[0, height - capHeight / 2, 0]}
        size={[length, capHeight, 0.055]}
      />
      {Array.from({ length: panelCount + 1 }, (_, index) => (
        <PlatformRailingMember
          key={index}
          name={`${name}-post-${index}`}
          at={[firstPost + index * postSpacing, height / 2, 0]}
          size={[postWidth, height, 0.04]}
        />
      ))}
      {Array.from({ length: panelCount }, (_, index) => (
        <mesh
          key={index}
          name={`${name}-glass-${index}`}
          position={[firstPost + (index + 0.5) * postSpacing, baseClearance + glassHeight / 2, 0]}
        >
          <planeGeometry args={[postSpacing - postWidth, glassHeight]} />
          <ToonMaterial
            color="#a5d1da"
            opacity={0.45}
            transparent
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}
