import { RoundedBox, ToonMaterial } from "@cabane/engine";
import { linenWeaveTexture } from "../../construction/linen-weave-texture";
import { GatheredCurtains } from "./gathered-curtain";
import { TimberFrame } from "./timber";
import { PillowNest } from "./cushion";
import { PatchworkQuilt } from "./patchwork-quilt";
import { BLUSH_LIGHT } from "./finish";

export function StorybookDaybed({ color }: { color?: string | undefined } = {}) {
  return (
    <group name="storybook-daybed" userData={{ walkCollider: true }}>
      <TimberFrame />
      <RoundedBox
        name="daybed-mattress"
        args={[1.075, 0.15, 2.31]}
        radius={0.062}
        position={[0, 0.353, 0]}
        smoothness={2}
        bevelSegments={2}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#f5e6d5" map={linenWeaveTexture} />
      </RoundedBox>
      <PatchworkQuilt />
      <PillowNest />
      <GatheredCurtains color={color ?? BLUSH_LIGHT} />
    </group>
  );
}
