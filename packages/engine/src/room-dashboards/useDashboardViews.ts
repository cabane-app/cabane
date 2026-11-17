import { useEffect, useState } from "react";
import { useHomeAssistantRuntime } from "../HomeAssistantRuntimeContext";
import { discoverDashboardViews } from "./dashboard-views";

/** Read only. Key results to the active session so another home's views never leak into the picker. */
export function useDashboardViews(enabled: boolean) {
  const { origin, status, sendStorageMessage } = useHomeAssistantRuntime();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<
    | ({
        sender: object;
        origin: string;
      } & Awaited<ReturnType<typeof discoverDashboardViews>>)
    | null
  >(null);
  useEffect(() => {
    if (!enabled || !origin || status !== "connected") return;
    let active = true;
    void (async () => {
      try {
        const discovered = await discoverDashboardViews(sendStorageMessage, origin);
        if (active)
          setResult({
            sender: sendStorageMessage,
            origin,
            ...discovered,
          });
      } catch {
        if (active)
          setResult({
            sender: sendStorageMessage,
            origin,
            views: [],
            automatic: false,
            error: "Could not load dashboard views. Retry or enter a view URL.",
          });
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled, origin, status, sendStorageMessage, revision]);
  const current =
    enabled &&
    status === "connected" &&
    result?.sender === sendStorageMessage &&
    result.origin === origin
      ? result
      : null;
  return {
    views: current?.views ?? [],
    automatic: current?.automatic ?? false,
    loading: enabled && status === "connected" && current === null,
    error: current?.error ?? null,
    retry: () => {
      setResult(null);
      setRevision((value) => value + 1);
    },
  };
}
