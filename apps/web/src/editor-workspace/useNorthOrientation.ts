import { editProject } from "./editor-project-actions";
import { useEffect, useState } from "react";
import type { EditorWorkspaceSnapshot } from "@cabane/engine";

/** Unpublished compass session: only Confirm enters the ordinary project history. */
export function useNorthOrientation({
  scope,
  enabled,
  snapshot,
  commit,
}: {
  scope: string;
  enabled: boolean;
  snapshot: EditorWorkspaceSnapshot;
  commit: (snapshot: EditorWorkspaceSnapshot) => void;
}) {
  const [session, setSession] = useState<{ scope: string; angle: number } | null>(null);
  useEffect(() => setSession(null), [scope]);
  const active = enabled && session?.scope === scope;
  const angle = session?.angle ?? snapshot.project.home.northAngleDegrees ?? 0;
  return {
    active,
    angle,
    start: () => {
      if (enabled) setSession({ scope, angle: snapshot.project.home.northAngleDegrees ?? 0 });
    },
    rotate: (next: number) =>
      setSession((current) => (current ? { ...current, angle: ((next % 360) + 360) % 360 } : null)),
    cancel: () => setSession(null),
    confirm: () => {
      if (active && angle !== (snapshot.project.home.northAngleDegrees ?? 0))
        commit(
          editProject(snapshot, {
            type: "update-home-settings",
            changes: { northAngleDegrees: angle },
          }),
        );
      setSession(null);
    },
  };
}
