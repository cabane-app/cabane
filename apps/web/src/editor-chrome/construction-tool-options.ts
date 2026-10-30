import type { EditorToolOption } from "./EditorToolGroup";

export const wallTools = [
  { tool: "wall", icon: "wall", label: "Wall", shortcut: "W" },
  { tool: "virtual-wall", icon: "virtual-wall", label: "Invisible wall" },
  { tool: "platform", icon: "outdoor-space", label: "Outdoor space" },
] as const satisfies readonly EditorToolOption[];
export const openingTools = [
  { tool: "door", icon: "door", label: "Door", shortcut: "D" },
  { tool: "passage", icon: "passage", label: "Passage", shortcut: "A" },
  { tool: "window", icon: "window", label: "Window", shortcut: "N" },
] as const satisfies readonly EditorToolOption[];
export const decorationTools = [
  { tool: "niche", icon: "niche", label: "Niche" },
  { tool: "hedge", icon: "hedge", label: "Boundary", shortcut: "H" },
  { tool: "pool", icon: "pool", label: "Pool", shortcut: "P" },
] as const satisfies readonly EditorToolOption[];
