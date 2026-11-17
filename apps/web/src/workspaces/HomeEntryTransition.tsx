import { DashboardSceneReadyContext, type HomeProject } from "@cabane/engine";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { HOME_ENTRY_REVEAL_MS, HomeEntryScreen, homeEntryDetails } from "./HomeEntryScreen";

export function HomeEntryTransition({
  project,
  children,
}: {
  project: HomeProject;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<"opening" | "revealing" | "done">("opening");
  const ready = useCallback(
    () => setPhase((current) => (current === "opening" ? "revealing" : current)),
    [],
  );
  useEffect(() => {
    if (phase !== "revealing") return;
    const timer = window.setTimeout(() => setPhase("done"), HOME_ENTRY_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);
  return (
    <>
      <DashboardSceneReadyContext.Provider value={phase === "opening" ? ready : null}>
        <div className="home-entry-dashboard" inert={phase === "opening"}>
          {children}
        </div>
      </DashboardSceneReadyContext.Provider>
      {phase !== "done" && (
        <HomeEntryScreen {...homeEntryDetails(project)} revealing={phase === "revealing"} />
      )}
    </>
  );
}
