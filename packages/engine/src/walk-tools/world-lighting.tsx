import type { WalkToolDefinition } from "./types";

export function renderWorldLighting(
  tools: readonly WalkToolDefinition[] | undefined,
  active: WalkToolDefinition | undefined,
  enabled: boolean,
) {
  return tools?.map(({ id, WorldLighting }) =>
    WorldLighting ? <WorldLighting key={id} active={enabled && id === active?.id} /> : null,
  );
}
