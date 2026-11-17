import { createContext, useContext, useEffect, useRef } from "react";

/** Called after the dashboard presents the home or its recovery screen. */
export const DashboardSceneReadyContext = createContext<(() => void) | null>(null);
export const DashboardRenderFailureContext = createContext<((error: unknown) => void) | null>(null);

export function DashboardFallbackReady() {
  const ready = useContext(DashboardSceneReadyContext);
  const reported = useRef(false);
  useEffect(() => {
    if (!ready || reported.current) return;
    reported.current = true;
    ready();
  }, [ready]);
  return null;
}
