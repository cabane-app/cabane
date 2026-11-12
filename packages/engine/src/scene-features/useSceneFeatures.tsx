import { Suspense, useState } from "react";
import type { SceneFeatureDefinition, SceneFeatureProps } from "./types";

/** Activation belongs to this dashboard session; changing homes starts with features off. */
export function useSceneFeatures(
  scope: string,
  definitions: readonly SceneFeatureDefinition[] | undefined,
  props: SceneFeatureProps,
  available: boolean,
) {
  const [selection, setSelection] = useState({ scope, ids: new Set<string>() });
  const selected = (id: string) => selection.scope === scope && selection.ids.has(id);
  const toggle = (id: string) =>
    setSelection((current) => {
      const ids = new Set(current.scope === scope ? current.ids : []);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      return { scope, ids };
    });
  return {
    menuItems: available
      ? definitions?.map((feature) => (
          <button
            key={feature.id}
            type="button"
            aria-pressed={selected(feature.id)}
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              toggle(feature.id);
            }}
          >
            <span aria-hidden="true">{selected(feature.id) ? "✓" : "+"}</span>
            <span>{`${selected(feature.id) ? "Disable" : "Enable"} ${feature.label}`}</span>
          </button>
        ))
      : null,
    scene: available
      ? definitions
          ?.filter((feature) => selected(feature.id))
          .map((feature) => (
            <Suspense key={`${scope}:${feature.id}`} fallback={null}>
              <feature.Scene {...props} />
            </Suspense>
          ))
      : null,
  };
}
