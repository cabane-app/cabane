import type { EditorMode } from "./EditorModeNav";

const introductions = {
  construct: {
    title: "Construct",
    description: "Draw your floor plan, then select walls, rooms or openings to edit them.",
  },
  furnish: {
    title: "Arrange",
    description: "Choose furniture and devices from the catalog, then place them in your home.",
  },
  connect: {
    title: "Connect",
    description: "Link your rooms and devices to Home Assistant to control them from Home.",
  },
  settings: {
    title: "Settings",
    description: "Manage your home and make Cabane feel natural to you.",
  },
} satisfies Record<EditorMode | "settings", { title: string; description: string }>;

export function EditorModeIntroduction({
  mode,
  constructPreview,
}: {
  mode: EditorMode | "settings";
  constructPreview?: boolean;
}) {
  const { title, description } = introductions[mode];
  return (
    <header className="editor-mode-introduction">
      <h2>{title}</h2>
      <p>
        {mode === "construct" && constructPreview
          ? "Inspect your draft in 3D. Choose a construction tool to return to the plan."
          : description}
      </p>
    </header>
  );
}
