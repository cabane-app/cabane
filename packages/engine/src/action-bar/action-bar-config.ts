import type { WalkToolDefinition } from "../walk-tools/types";

export type ActionBarBuiltIn = "build" | "walk" | "night" | "weather" | "view" | "all-lights";

export type ActionBarTarget =
  | { kind: "built-in"; action: ActionBarBuiltIn }
  | { kind: "walk-tool"; toolId: string }
  | { kind: "scene-feature"; featureId: string }
  | { kind: "room"; roomId: string }
  | { kind: "device"; deviceId: string }
  | { kind: "scene" }
  | { kind: "script" };

export interface ActionBarItem {
  id: string;
  target: ActionBarTarget;
}

export interface ActionBarConfiguration {
  items: readonly ActionBarItem[];
}

export const defaultActionBarItems: readonly ActionBarItem[] = [
  { id: "default-build", target: { kind: "built-in", action: "build" } },
  { id: "default-walk", target: { kind: "built-in", action: "walk" } },
  { id: "default-night", target: { kind: "built-in", action: "night" } },
  { id: "default-weather", target: { kind: "built-in", action: "weather" } },
  { id: "default-view", target: { kind: "built-in", action: "view" } },
];

type DefaultTool = Pick<WalkToolDefinition, "id" | "defaultShortcut">;

export function resolveActionBarItems(
  config?: ActionBarConfiguration,
  tools: readonly DefaultTool[] = [],
): readonly ActionBarItem[] {
  if (config) return config.items;
  const defaults = tools.filter((tool) => tool.defaultShortcut);
  return defaults.length
    ? [
        ...defaultActionBarItems,
        ...defaults.map((tool) => ({
          id: `default-tool-${tool.id}`,
          target: { kind: "walk-tool" as const, toolId: tool.id },
        })),
      ]
    : defaultActionBarItems;
}

const builtInActions = new Set<ActionBarBuiltIn>([
  "build",
  "walk",
  "night",
  "weather",
  "view",
  "all-lights",
]);

export const isActionBarBuiltIn = (value: unknown): value is ActionBarBuiltIn =>
  typeof value === "string" && builtInActions.has(value as ActionBarBuiltIn);

/** Published records can be corrupt even when normal project imports are validated. */
export function resolvePublishedActionBarItems(
  config: unknown,
  tools: readonly DefaultTool[] = [],
): readonly ActionBarItem[] {
  if (config === undefined) return resolveActionBarItems(undefined, tools);
  const rawItems =
    config !== null && typeof config === "object" && !Array.isArray(config)
      ? (config as { items?: unknown }).items
      : undefined;
  if (!Array.isArray(rawItems))
    return [
      { id: "unavailable-action-bar", target: { kind: "room", roomId: "unavailable-action-bar" } },
    ];
  const seen = new Set<string>();
  return rawItems.map((raw, index) => {
    const fallback: ActionBarItem = {
      id: `unavailable-action-${index}`,
      target: { kind: "room", roomId: `unavailable-action-${index}` },
    };
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return fallback;
    const item = raw as { id?: unknown; target?: unknown };
    if (
      typeof item.id !== "string" ||
      !item.id.trim() ||
      seen.has(item.id) ||
      item.target === null ||
      typeof item.target !== "object" ||
      Array.isArray(item.target)
    )
      return fallback;
    seen.add(item.id);
    const target = item.target as {
      kind?: unknown;
      action?: unknown;
      roomId?: unknown;
      deviceId?: unknown;
      toolId?: unknown;
      featureId?: unknown;
    };
    if (target.kind === "built-in" && isActionBarBuiltIn(target.action))
      return {
        id: item.id,
        target: { kind: "built-in", action: target.action as ActionBarBuiltIn },
      };
    if (target.kind === "scene" || target.kind === "script")
      return { id: item.id, target: { kind: target.kind } };
    if (target.kind === "walk-tool" && typeof target.toolId === "string" && target.toolId.trim())
      return { id: item.id, target: { kind: "walk-tool", toolId: target.toolId } };
    if (
      target.kind === "scene-feature" &&
      typeof target.featureId === "string" &&
      target.featureId.trim()
    )
      return { id: item.id, target: { kind: "scene-feature", featureId: target.featureId } };
    if (target.kind === "room" && typeof target.roomId === "string" && target.roomId.trim())
      return { id: item.id, target: { kind: "room", roomId: target.roomId } };
    if (target.kind === "device" && typeof target.deviceId === "string" && target.deviceId.trim())
      return { id: item.id, target: { kind: "device", deviceId: target.deviceId } };
    return fallback;
  });
}
