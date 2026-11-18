import { RoundedBox, ToonMaterial } from "@cabane/engine";
import { linenWeaveTexture } from "../../construction/linen-weave-texture";
import { CANOPY_CORAL } from "./cabin-bed-finish";
import { PillowAndBumper } from "./cushion";
import { IvoryDuvet } from "./duvet";
import { GatheredCurtains } from "./gathered-curtain";
import { CottonBallGarland } from "./garland";
import { TimberFrame } from "./timber";

export function CabinBed({ color }: { color?: string | undefined } = {}) {
  return (
    <group name="lit-cabane-bedroom-three-custom" userData={{ walkCollider: true }}>
      <TimberFrame />
      <RoundedBox
        name="ivory-mattress"
        args={[1.078, 0.123, 2.231]}
        radius={0.049}
        position={[-0.0055, 0.34, 0]}
        smoothness={2}
        bevelSegments={2}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#f6eddf" map={linenWeaveTexture} />
      </RoundedBox>
      <IvoryDuvet />
      <PillowAndBumper />
      <GatheredCurtains color={color ?? CANOPY_CORAL} />
      <CottonBallGarland />
    </group>
  );
}
