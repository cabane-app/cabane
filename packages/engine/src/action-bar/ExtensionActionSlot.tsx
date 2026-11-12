import { SceneActionSlotFace } from "../SceneActionSlotFace";
import type { SceneFeatureDefinition } from "../scene-features/types";
import type { WalkToolDefinition } from "../walk-tools";
import type { ActionBarItem } from "./action-bar-config";

/** Host-installed actions share the dock face, while tools retain their Walk restriction. */
export function ExtensionActionSlot({
  item,
  walkTools,
  sceneFeatures,
  mode,
  activeWalkToolId,
  activeSceneFeatureIds,
  onAction,
}: {
  item: ActionBarItem;
  walkTools: readonly WalkToolDefinition[];
  sceneFeatures: readonly SceneFeatureDefinition[];
  mode: string;
  activeWalkToolId: string | null | undefined;
  activeSceneFeatureIds: ReadonlySet<string> | undefined;
  onAction: (item: ActionBarItem) => void;
}) {
  const target = item.target;
  const tool =
    target.kind === "walk-tool" ? walkTools.find((tool) => tool.id === target.toolId) : undefined;
  const feature =
    target.kind === "scene-feature"
      ? sceneFeatures.find((feature) => feature.id === target.featureId)
      : undefined;
  const installed = tool ?? feature;
  const active = tool
    ? activeWalkToolId === tool.id
    : !!feature && !!activeSceneFeatureIds?.has(feature.id);
  const label = tool
    ? `${active ? "Unequip" : "Equip"} ${tool.label}`
    : (feature?.label ?? (target.kind === "walk-tool" ? "Unavailable tool" : "Unavailable action"));
  return (
    <button
      type="button"
      className={`scene-action-slot is-filled ${active ? "is-active" : ""}`}
      aria-label={label}
      aria-pressed={active}
      aria-keyshortcuts={tool?.shortcutKey}
      title={tool && mode !== "walk" ? "Enter Walk mode to equip this tool" : installed?.label}
      disabled={!installed || (!!tool && mode !== "walk")}
      onClick={() => onAction(item)}
    >
      <SceneActionSlotFace
        label={installed?.label ?? "Unavailable"}
        shortcut={tool?.shortcutKey}
        icon={installed ? <installed.Icon /> : null}
      />
    </button>
  );
}
