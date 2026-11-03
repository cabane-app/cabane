import { Outlines, ToonMaterial } from "@cabane/engine";
import { Timber } from "./timber";
import { Cushion } from "./cushion";
import { PlushBear } from "./plush-bear";
import { CanopyRoof } from "./canopy-roof";
import { GuardRail } from "./guard-rail";
import { WOOD, WOOD_DARK, BLUSH_LIGHT } from "./cabin-bed-finish";

export function CabinBed({ color }: { color?: string | undefined } = {}) {
  const halfWidth = 0.55;
  const halfLength = 1.18;
  const eaveHeight = 1.12;
  const ridgeHeight = 1.66;
  const roofAngle = Math.atan2(ridgeHeight - eaveHeight, halfWidth);
  const roofBeamLength = Math.hypot(ridgeHeight - eaveHeight, halfWidth);

  return (
    <group name="lit-cabane-bedroom-three-custom" userData={{ walkCollider: true }}>
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.08, 0.18, 2.34, 3, 1, 6]} />
        <ToonMaterial color={WOOD} />
        <Outlines thickness={0.007} color={WOOD_DARK} screenspace={false} />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[1.01, 0.14, 2.25, 4, 2, 8]} />
        <ToonMaterial color={color ?? "#e9bcb9"} />
        <Outlines thickness={0.006} color="#785b58" screenspace={false} />
      </mesh>
      <mesh position={[0, 0.37, 0]} castShadow>
        <boxGeometry args={[0.96, 0.035, 2.16, 4, 1, 8]} />
        <ToonMaterial color={color ?? "#f0d0ca"} />
      </mesh>

      {[-halfWidth, halfWidth].flatMap((postX) =>
        [-halfLength, halfLength].map((postZ) => (
          <Timber
            key={`${postX}-${postZ}`}
            length={eaveHeight}
            position={[postX, eaveHeight / 2, postZ]}
          />
        )),
      )}
      {[-halfWidth, halfWidth].map((railX) => (
        <Timber
          key={`base-${railX}`}
          length={halfLength * 2}
          radius={0.035}
          position={[railX, 0.16, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}
      {[-halfWidth, halfWidth].map((railX) => (
        <Timber
          key={`eave-${railX}`}
          length={halfLength * 2}
          position={[railX, eaveHeight, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}
      <Timber
        length={halfLength * 2}
        position={[0, ridgeHeight, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      {[-halfLength, halfLength].flatMap((gableZ) =>
        [-1, 1].map((side) => (
          <Timber
            key={`${gableZ}-${side}`}
            length={roofBeamLength}
            position={[side * halfWidth * 0.5, (eaveHeight + ridgeHeight) / 2, gableZ]}
            rotation={[0, 0, side * (Math.PI / 2 - roofAngle)]}
          />
        )),
      )}

      <CanopyRoof side={-1} roofAngle={roofAngle} roofBeamLength={roofBeamLength} color={color} />
      <CanopyRoof side={1} roofAngle={roofAngle} roofBeamLength={roofBeamLength} color={color} />
      <mesh position={[halfWidth - 0.015, 0.69, 0.03]} castShadow>
        <boxGeometry args={[0.018, 0.82, 2.18, 1, 5, 12]} />
        <ToonMaterial color={color ?? BLUSH_LIGHT} side={2} />
      </mesh>
      {[-0.83, 0.83].map((z, index) => (
        <mesh
          key={z}
          position={[-halfWidth - 0.005, 0.71, z]}
          rotation={[0, index === 0 ? -0.08 : 0.08, index === 0 ? -0.025 : 0.025]}
          castShadow
        >
          <boxGeometry args={[0.018, 0.78, 0.58, 1, 6, 5]} />
          <ToonMaterial color={color ?? BLUSH_LIGHT} side={2} />
          <Outlines color="#a36f70" thickness={0.003} screenspace={false} />
        </mesh>
      ))}

      <GuardRail z={-0.82} />
      <GuardRail z={0.82} />
      <Cushion
        position={[-0.28, 0.5, -0.78]}
        color="#f0ded5"
        scale={[0.34, 0.22, 0.42]}
        rotationY={-0.08}
      />
      <Cushion
        position={[0.05, 0.49, -0.76]}
        color="#c78c91"
        scale={[0.33, 0.22, 0.41]}
        rotationY={0.05}
      />
      <Cushion
        position={[0.31, 0.5, -0.73]}
        color="#e5bdb2"
        scale={[0.31, 0.2, 0.38]}
        rotationY={0.1}
      />
      <PlushBear />
    </group>
  );
}
