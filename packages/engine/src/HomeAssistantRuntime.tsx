import { HomeAssistantActivityTracker } from "./home-assistant-activity";
import { createSessionStorageSender } from "./home-assistant-storage-session";
import { BorrowedHomeAssistantRuntime } from "./BorrowedHomeAssistantRuntime";
import {
  useHomeAssistantHostSession,
  type HomeAssistantHostSession,
} from "./HomeAssistantHostSession";
export {
  HomeAssistantHostSessionProvider,
  useHomeAssistantHostSession,
  type HomeAssistantHostSession,
} from "./HomeAssistantHostSession";
import { getAuth, type Auth, type Connection } from "home-assistant-js-websocket";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { DeviceCommandScheduler } from "./command-scheduler";

import type { HomeAssistantCameraClient, HomeAssistantCameraMessage } from "./camera-runtime";

import {
  cleanAuthenticationCallback,
  hasAuthenticationCallback,
  homeAssistantLogoutStorageKey,
  invalidateStoredAuthData,
  readLogoutGeneration,
  homeAssistantTransportError,
  loadStoredAuthData,
  normalizeHomeAssistantUrl,
  saveStoredAuthData,
} from "./home-assistant-auth";

import { getCallbackAuthOnce } from "./home-assistant-callback-auth";
import { requestPopupAuthorizationCode } from "./home-assistant-popup-auth";
import { markEntityStatesStale, normalizeEntityStates } from "./home-assistant-entity-snapshots";
import { DEFAULT_CLIENT, HomeAssistantRuntimeClient } from "./home-assistant-runtime-client";
import { homeAssistantErrorMessage, isAuthenticationError } from "./home-assistant-runtime-errors";
import {
  EMPTY_STATES,
  HomeAssistantRuntimeContext,
  HomeAssistantRuntimeValue,
} from "./HomeAssistantRuntimeContext";
import type {
  EntityId,
  EntityStateSnapshot,
  HomeAssistantAreaRegistryEntry,
  HomeAssistantConnectionStatus,
  HomeAssistantDeviceRegistryEntry,
  HomeAssistantEntityRegistryEntry,
} from "./types";

function HomeAssistantRuntimeProviderImpl({
  homeAssistantUrl,
  children,
  client,
}: {
  homeAssistantUrl?: (string | null) | undefined;
  children: ReactNode;
  client: HomeAssistantRuntimeClient;
}) {
  const normalizedUrl = useMemo(
    () => normalizeHomeAssistantUrl(homeAssistantUrl),
    [homeAssistantUrl],
  );
  const clientId = typeof window === "undefined" ? "" : window.location.origin;
  const [status, setStatus] = useState<HomeAssistantConnectionStatus>(
    normalizedUrl ? "disconnected" : "unconfigured",
  );
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<HomeAssistantAreaRegistryEntry[]>([]);
  const [devices, setDevices] = useState<HomeAssistantDeviceRegistryEntry[]>([]);
  const [entityRegistry, setEntityRegistry] = useState<HomeAssistantEntityRegistryEntry[]>([]);
  const [entityStates, setEntityStates] =
    useState<Readonly<Record<EntityId, EntityStateSnapshot>>>(EMPTY_STATES);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const originRef = useRef(normalizedUrl);
  originRef.current = normalizedUrl;
  const statusRef = useRef(status);
  const connectionRef = useRef<Connection | null>(null);
  const authRef = useRef<Auth | null>(null);
  const unsubscribeRef = useRef<Array<() => void | Promise<void>>>([]);
  const lifecycleRef = useRef(0);
  const attemptRef = useRef(false);
  const cancelledThroughRef = useRef(-1);
  const sessionGenerationRef = useRef<string | null>(null);
  const registryDeviceIdsRef = useRef(new Map<EntityId, string | null>());

  const updateStatus = useCallback((next: HomeAssistantConnectionStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    registryDeviceIdsRef.current = new Map(
      entityRegistry.map((entry) => [entry.entity_id, entry.device_id]),
    );
  }, [entityRegistry]);

  const schedulerRef = useRef<DeviceCommandScheduler | null>(null);
  const schedulerDisposalTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  if (schedulerRef.current === null) {
    schedulerRef.current = new DeviceCommandScheduler({
      dispatch: (call) => {
        const connection = connectionRef.current;
        if (!connection || statusRef.current !== "connected") {
          return Promise.reject(new Error("Home Assistant is not connected."));
        }
        return client.callService(connection, call.domain, call.service, call.data, call.target);
      },
      resolveDeviceKey: (entityId) =>
        registryDeviceIdsRef.current.get(entityId) ?? `entity:${entityId}`,
    });
  }

  const teardownConnection = useCallback(() => {
    for (const unsubscribe of unsubscribeRef.current.splice(0)) void unsubscribe();
    connectionRef.current?.close();
    connectionRef.current = null;
    schedulerRef.current?.cancelPendingValues();
  }, []);

  const clearRuntimeData = useCallback(() => {
    setAreas([]);
    setDevices([]);
    setEntityRegistry([]);
    setEntityStates(EMPTY_STATES);
    setRefreshing(false);
    setRefreshError(null);
  }, []);

  const refresh = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection) throw new Error("Home Assistant is not connected.");
    const lifecycle = lifecycleRef.current;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const [nextAreas, nextDevices, nextEntities] = await Promise.all([
        connection.sendMessagePromise<HomeAssistantAreaRegistryEntry[]>({
          type: "config/area_registry/list",
        }),
        connection.sendMessagePromise<HomeAssistantDeviceRegistryEntry[]>({
          type: "config/device_registry/list",
        }),
        connection.sendMessagePromise<HomeAssistantEntityRegistryEntry[]>({
          type: "config/entity_registry/list",
        }),
      ]);
      if (lifecycle !== lifecycleRef.current) return;
      setAreas(nextAreas);
      setDevices(nextDevices);
      setEntityRegistry(nextEntities);
    } catch (caught) {
      if (lifecycle !== lifecycleRef.current) return;
      setRefreshError(homeAssistantErrorMessage(caught));
      throw caught;
    } finally {
      if (lifecycle === lifecycleRef.current) setRefreshing(false);
    }
  }, []);

  const startSession = useCallback(
    async (userInitiated: boolean) => {
      if (!normalizedUrl || typeof window === "undefined" || attemptRef.current) return;
      const callback = hasAuthenticationCallback(window.location.href);
      const transportError = homeAssistantTransportError(window.location.href, normalizedUrl);
      if (transportError) {
        if (callback) cleanAuthenticationCallback(window.location.href, window.history);
        setError(transportError);
        updateStatus("error");
        return;
      }
      const storage = window.localStorage;
      const generation = readLogoutGeneration(storage, normalizedUrl, clientId);
      const storedTokens = loadStoredAuthData(storage, normalizedUrl, clientId);
      if (!userInitiated && !callback && !storedTokens) {
        updateStatus("disconnected");
        return;
      }

      const lifecycle = ++lifecycleRef.current;
      sessionGenerationRef.current = generation;
      const isCurrent = () =>
        lifecycle === lifecycleRef.current &&
        generation === readLogoutGeneration(storage, normalizedUrl, clientId);
      attemptRef.current = true;
      setError(null);
      updateStatus(callback || userInitiated ? "authenticating" : "connecting");
      try {
        const authOptions: NonNullable<Parameters<typeof getAuth>[0]> = {
          hassUrl: normalizedUrl,
          clientId,
          redirectUrl: window.location.href,
          limitHassInstance: true,
          loadTokens: async () => storedTokens,
          saveTokens: (tokens) => {
            if (isCurrent())
              saveStoredAuthData(storage, tokens, normalizedUrl, clientId, generation);
          },
        };
        if (userInitiated && !callback && !storedTokens && window.self !== window.top) {
          authOptions.authCode = await requestPopupAuthorizationCode(
            window,
            normalizedUrl,
            isCurrent,
          );
          if (!isCurrent()) return;
        }
        const auth = await (callback
          ? getCallbackAuthOnce(client, normalizedUrl, clientId, authOptions, generation)
          : client.getAuth(authOptions));
        if (!isCurrent()) {
          // Effect cleanup (including Strict Mode) must not revoke a shared Auth.
          if (
            lifecycle <= cancelledThroughRef.current ||
            generation !== readLogoutGeneration(storage, normalizedUrl, clientId)
          ) {
            const current = authRef.current;
            const stored = loadStoredAuthData(
              {
                getItem: (key) => storage.getItem(key),
                removeItem: () => undefined,
              },
              normalizedUrl,
              clientId,
            );
            const sameCredential = (data: Auth["data"] | null | undefined) =>
              data &&
              data.hassUrl === auth.data.hassUrl &&
              data.refresh_token === auth.data.refresh_token;
            if (!sameCredential(current?.data) && !sameCredential(stored)) {
              try {
                await auth.revoke();
              } catch {
                /* Local logout remains effective. */
              }
            }
          }
          return;
        }
        if (callback) cleanAuthenticationCallback(window.location.href, window.history);
        authRef.current = auth;
        updateStatus("connecting");
        teardownConnection();

        const connection = await client.createConnection({ auth, setupRetry: 3 });
        if (!isCurrent()) {
          connection.close();
          return;
        }
        connectionRef.current = connection;
        const activity = new HomeAssistantActivityTracker();

        const refreshRegistries = async () => {
          const [nextAreas, nextDevices, nextEntities] = await Promise.all([
            connection.sendMessagePromise<HomeAssistantAreaRegistryEntry[]>({
              type: "config/area_registry/list",
            }),
            connection.sendMessagePromise<HomeAssistantDeviceRegistryEntry[]>({
              type: "config/device_registry/list",
            }),
            connection.sendMessagePromise<HomeAssistantEntityRegistryEntry[]>({
              type: "config/entity_registry/list",
            }),
          ]);
          if (!isCurrent()) return;
          setAreas(nextAreas);
          setDevices(nextDevices);
          setEntityRegistry(nextEntities);
        };

        const handleReady = () => {
          if (!isCurrent()) return;
          activity.reset();
          void refreshRegistries()
            .then(() => {
              if (!isCurrent()) return;
              setError(null);
              updateStatus("connected");
            })
            .catch((refreshError: unknown) => {
              if (!isCurrent()) return;
              setError(homeAssistantErrorMessage(refreshError));
              updateStatus("error");
            });
        };
        const handleDisconnected = () => {
          if (!isCurrent()) return;
          schedulerRef.current?.cancelPendingValues();
          activity.reset();
          setEntityStates((current) => markEntityStatesStale(current));
          updateStatus("reconnecting");
        };
        const handleReconnectError = (_connection: Connection, reconnectError?: unknown) => {
          if (!isCurrent()) return;
          schedulerRef.current?.cancelPendingValues();
          if (isAuthenticationError(reconnectError)) {
            saveStoredAuthData(window.localStorage, null, normalizedUrl, clientId);
            setError(homeAssistantErrorMessage(reconnectError));
            updateStatus("auth-expired");
          } else {
            setError(homeAssistantErrorMessage(reconnectError));
            updateStatus("error");
          }
        };
        connection.addEventListener("ready", handleReady);
        connection.addEventListener("disconnected", handleDisconnected);
        connection.addEventListener("reconnect-error", handleReconnectError);
        unsubscribeRef.current.push(() => {
          connection.removeEventListener("ready", handleReady);
          connection.removeEventListener("disconnected", handleDisconnected);
          connection.removeEventListener("reconnect-error", handleReconnectError);
        });

        await refreshRegistries();
        if (!isCurrent()) return;
        unsubscribeRef.current.push(
          client.subscribeEntities(connection, (states) => {
            if (isCurrent()) {
              const snapshot = normalizeEntityStates(states, connection.connected === false);
              setEntityStates(activity.update(snapshot));
            }
          }),
        );
        for (const eventType of [
          "area_registry_updated",
          "device_registry_updated",
          "entity_registry_updated",
        ]) {
          const unsubscribe = await connection.subscribeEvents(() => {
            void refreshRegistries().catch((refreshError: unknown) => {
              if (!isCurrent()) return;
              setError(homeAssistantErrorMessage(refreshError));
              updateStatus("error");
            });
          }, eventType);
          if (!isCurrent()) {
            void unsubscribe();
            return;
          }
          unsubscribeRef.current.push(unsubscribe);
        }
        updateStatus("connected");
      } catch (connectionError: unknown) {
        if (lifecycle !== lifecycleRef.current) return;
        if (callback && typeof window !== "undefined") {
          cleanAuthenticationCallback(window.location.href, window.history);
        }
        if (!isCurrent()) return;
        if (isAuthenticationError(connectionError)) {
          saveStoredAuthData(window.localStorage, null, normalizedUrl, clientId);
          updateStatus("auth-expired");
        } else updateStatus("error");
        setError(homeAssistantErrorMessage(connectionError));
      } finally {
        if (lifecycle === lifecycleRef.current) attemptRef.current = false;
      }
    },
    [client, clientId, normalizedUrl, teardownConnection, updateStatus],
  );

  useEffect(() => {
    lifecycleRef.current += 1;
    attemptRef.current = false;
    teardownConnection();
    clearRuntimeData();
    authRef.current = null;
    setError(null);
    if (!normalizedUrl) {
      updateStatus("unconfigured");
      return undefined;
    }
    updateStatus("disconnected");
    void startSession(false);
    return () => {
      lifecycleRef.current += 1;
      attemptRef.current = false;
      teardownConnection();
      authRef.current = null;
    };
  }, [clearRuntimeData, normalizedUrl, startSession, teardownConnection, updateStatus]);

  useEffect(() => {
    if (schedulerDisposalTimerRef.current !== null) {
      globalThis.clearTimeout(schedulerDisposalTimerRef.current);
      schedulerDisposalTimerRef.current = null;
    }
    return () => {
      schedulerDisposalTimerRef.current = globalThis.setTimeout(() => {
        schedulerRef.current?.dispose();
        schedulerRef.current = null;
        schedulerDisposalTimerRef.current = null;
      }, 0);
    };
  }, []);

  const disconnectLocally = useCallback(() => {
    cleanAuthenticationCallback(window.location.href, window.history);
    cancelledThroughRef.current = lifecycleRef.current;
    lifecycleRef.current += 1;
    attemptRef.current = false;
    teardownConnection();
    clearRuntimeData();
    const auth = authRef.current;
    authRef.current = null;
    updateStatus(normalizedUrl ? "disconnected" : "unconfigured");
    setError(null);
    return auth;
  }, [clearRuntimeData, normalizedUrl, teardownConnection, updateStatus]);

  useEffect(() => {
    if (!normalizedUrl) return;
    const storage = window.localStorage;
    const onStorage = (event: StorageEvent) => {
      if (
        event.storageArea !== storage ||
        (event.key !== homeAssistantLogoutStorageKey(normalizedUrl, clientId) && event.key !== null)
      )
        return;
      const next = readLogoutGeneration(storage, normalizedUrl, clientId);
      if (next === sessionGenerationRef.current) return;
      sessionGenerationRef.current = next;
      const auth = disconnectLocally();
      void auth?.revoke().catch(() => undefined);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clientId, normalizedUrl, disconnectLocally]);

  const disconnect = useCallback(async () => {
    const auth = disconnectLocally();
    const lifecycle = lifecycleRef.current;
    // Clear synchronously, before awaiting the server. Old revoke callbacks
    // cannot clear storage belonging to a subsequent login.
    if (normalizedUrl) {
      invalidateStoredAuthData(window.localStorage, normalizedUrl, clientId);
      sessionGenerationRef.current = readLogoutGeneration(
        window.localStorage,
        normalizedUrl,
        clientId,
      );
    }
    try {
      await auth?.revoke();
    } catch {
      if (lifecycle === lifecycleRef.current) {
        setError("Disconnected locally, but token revocation could not be confirmed.");
      }
    }
  }, [clientId, normalizedUrl, disconnectLocally]);

  const cameraClient = useMemo<HomeAssistantCameraClient | null>(() => {
    if (status !== "connected") return null;
    const lifecycle = lifecycleRef.current;
    return {
      sendMessagePromise: <T,>(message: Parameters<Connection["sendMessagePromise"]>[0]) => {
        const connection = connectionRef.current;
        if (
          lifecycle !== lifecycleRef.current ||
          !connection ||
          statusRef.current !== "connected"
        ) {
          return Promise.reject(new Error("Home Assistant is not connected."));
        }
        return connection.sendMessagePromise<T>(message);
      },
      subscribeMessage: <T,>(
        callback: (message: T) => void,
        message: HomeAssistantCameraMessage,
        options?: { resubscribe?: boolean },
      ) => {
        const connection = connectionRef.current;
        if (
          lifecycle !== lifecycleRef.current ||
          !connection ||
          statusRef.current !== "connected"
        ) {
          return Promise.reject(new Error("Home Assistant is not connected."));
        }
        return connection.subscribeMessage<T>(callback, message, options);
      },
    };
  }, [status]);

  const sendStorageMessage = useMemo(
    () =>
      createSessionStorageSender(normalizedUrl, () => ({
        origin: originRef.current,
        connection: connectionRef.current,
        status: statusRef.current,
        lifecycle: lifecycleRef.current,
      })),
    [normalizedUrl],
  );

  const value = useMemo<HomeAssistantRuntimeValue>(() => {
    const lifecycle = lifecycleRef.current;
    return {
      status,
      configured: Boolean(normalizedUrl),
      canMutate: status === "connected",
      origin: normalizedUrl,
      error,
      areas,
      devices,
      entityRegistry,
      entityStates,
      connect: () => {
        void startSession(true);
      },
      disconnect,
      retry: () => {
        void startSession(false);
      },
      refreshing,
      refreshError,
      refresh,
      callService: (call) =>
        lifecycle !== lifecycleRef.current || !schedulerRef.current
          ? Promise.reject(new Error("This Home Assistant session is no longer active."))
          : schedulerRef.current.schedule(call),
      cameraClient,
      sendStorageMessage,
    };
  }, [
    areas,
    cameraClient,
    devices,
    disconnect,
    entityRegistry,
    entityStates,
    error,
    normalizedUrl,
    refresh,
    refreshError,
    refreshing,
    startSession,
    sendStorageMessage,
    status,
  ]);

  return (
    <HomeAssistantRuntimeContext.Provider value={value}>
      {children}
    </HomeAssistantRuntimeContext.Provider>
  );
}

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
    <HomeAssistantRuntimeProviderImpl homeAssistantUrl={homeAssistantUrl} client={client}>
      {children}
    </HomeAssistantRuntimeProviderImpl>
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
