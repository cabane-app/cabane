import type { ReactNode } from "react";
import { BorrowedHomeAssistantRuntime } from "./BorrowedHomeAssistantRuntime";
import { StandaloneHomeAssistantRuntime } from "./StandaloneHomeAssistantRuntime";
import {
  useHomeAssistantHostSession,
  type HomeAssistantHostSession,
} from "./HomeAssistantHostSession";
import { DEFAULT_CLIENT, type HomeAssistantRuntimeClient } from "./home-assistant-runtime-client";

export {
  HomeAssistantHostSessionProvider,
  useHomeAssistantHostSession,
  type HomeAssistantHostSession,
} from "./HomeAssistantHostSession";

export function HomeAssistantRuntimeProvider(props: {
  homeAssistantUrl?: string | null;
  hostSession?: (HomeAssistantHostSession | null) | undefined;
  children: ReactNode;
}) {
  return <HomeAssistantRuntimeTestProvider {...props} client={DEFAULT_CLIENT} />;
}

export function HomeAssistantRuntimeTestProvider({
  homeAssistantUrl,
  hostSession,
  client,
  children,
}: {
  homeAssistantUrl?: string | null;
  hostSession?: HomeAssistantHostSession | null | undefined;
  client: HomeAssistantRuntimeClient;
  children: ReactNode;
}) {
  const inherited = useHomeAssistantHostSession();
  const session = hostSession === undefined ? inherited : hostSession;
  return session ? (
    <BorrowedHomeAssistantRuntime
      session={session}
      homeAssistantUrl={homeAssistantUrl}
      client={client}
    >
      {children}
    </BorrowedHomeAssistantRuntime>
  ) : (
    <StandaloneHomeAssistantRuntime homeAssistantUrl={homeAssistantUrl} client={client}>
      {children}
    </StandaloneHomeAssistantRuntime>
  );
}

export { HomeAssistantRuntimeSnapshotTestProvider } from "./HomeAssistantRuntimeSnapshotTestProvider";
export { markEntityStatesStale, normalizeEntityStates } from "./home-assistant-entity-snapshots";
export { homeAssistantErrorMessage } from "./home-assistant-runtime-errors";
export {
  HomeAssistantRuntimeValueProvider,
  useHomeAssistantRuntime,
} from "./HomeAssistantRuntimeContext";
export type { HomeAssistantRuntimeValue } from "./HomeAssistantRuntimeContext";
