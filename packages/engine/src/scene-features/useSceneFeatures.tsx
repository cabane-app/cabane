import { Suspense, useState } from "react";
import type { ActionBarItem } from "../action-bar/action-bar-config";
import type { SceneFeatureDefinition, SceneFeatureProps } from "./types";

/** Only configured shortcuts may mount an installation, and only after invocation. */
export function useSceneFeatures(
  scope: string,
  definitions: readonly SceneFeatureDefinition[] | undefined,
  props: SceneFeatureProps,
  available: boolean,
  shortcuts: readonly ActionBarItem[],
) {
  const [invocations, setInvocations] = useState<Record<string, number>>({});
  const allowed = new Set(
    shortcuts.flatMap(({ target }) => (target.kind === "scene-feature" ? [target.featureId] : [])),
  );
  const [selection, setSelection] = useState({ scope, ids: new Set<string>() });
  const ids = new Set(
    [...selection.ids].filter((id) => selection.scope === scope && allowed.has(id)),
  );
  // Forget removed shortcuts, including when they are later added again.
  if (selection.scope !== scope || ids.size !== selection.ids.size) setSelection({ scope, ids });
  const invoke = (id: string) => {
    if (available && allowed.has(id) && definitions?.some((feature) => feature.id === id)) {
      setSelection({ scope, ids: new Set([...ids, id]) });
      setInvocations((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
    }
  };
  return {
    invoke,
    actionHandler: (fallback: (item: ActionBarItem) => void) => (item: ActionBarItem) =>
      item.target.kind === "scene-feature" ? invoke(item.target.featureId) : fallback(item),
    activeIds: available ? ids : new Set<string>(),
    scene: available
      ? definitions
          ?.filter((feature) => ids.has(feature.id))
          .map((feature) => (
            <Suspense key={`${scope}:${feature.id}`} fallback={null}>
              <feature.Scene {...props} invocation={invocations[feature.id] ?? 0} />
            </Suspense>
          ))
      : null,
  };
}
