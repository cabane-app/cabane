import { HomeAssistantActivityTracker } from "./home-assistant-activity";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { HomeAssistantCameraMessage } from "./camera-runtime";
import { DeviceCommandScheduler } from "./command-scheduler";
import {
  normalizeHomeAssistantUrl,
  borrowedHomeAssistantTransportError,
} from "./home-assistant-auth";
import { normalizeEntityStates, markEntityStatesStale } from "./home-assistant-entity-snapshots";
import { homeAssistantErrorMessage } from "./home-assistant-runtime-errors";
import {
  EMPTY_STATES,
  HomeAssistantRuntimeValueProvider,
  type HomeAssistantRuntimeValue,
} from "./HomeAssistantRuntimeContext";
import type { HomeAssistantHostSession } from "./HomeAssistantHostSession";
import type { HomeAssistantRuntimeClient } from "./home-assistant-runtime-client";
import type {
  HomeAssistantRuntimeSnapshot,
  HomeAssistantAreaRegistryEntry,
  HomeAssistantDeviceRegistryEntry,
  HomeAssistantEntityRegistryEntry,
} from "./types";

type Attachment = {
  active: boolean;
  connected: boolean;
  epoch: number;
  scheduler: DeviceCommandScheduler;
  dispose: () => void;
  refresh: () => Promise<void>;
  subscriptions: Set<() => void>;
};
const inactive = () => new Error("This Home Assistant session is no longer active.");

/** A borrowed connection deliberately has no authentication or storage lifecycle. */
export function BorrowedHomeAssistantRuntime({
  session,
  homeAssistantUrl,
  client,
  children,
}: {
  session: HomeAssistantHostSession;
  homeAssistantUrl?: (string | null) | undefined;
  client: HomeAssistantRuntimeClient;
  children: ReactNode;
}) {
  const origin = normalizeHomeAssistantUrl(homeAssistantUrl);
  const hostOrigin = normalizeHomeAssistantUrl(session.origin);
  const connection = session.connection;
  const [revision, setRevision] = useState(0);
  const [detached, setDetached] = useState(false);
  const [state, setState] = useState<HomeAssistantRuntimeSnapshot>({
    status: "unconfigured",
    configured: false,
    canMutate: false,
    origin: null,
    error: null,
    areas: [],
    devices: [],
    entityRegistry: [],
    entityStates: EMPTY_STATES,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const attachmentRef = useRef<Attachment | null>(null);
  const transportError =
    origin && typeof window !== "undefined"
      ? borrowedHomeAssistantTransportError(window.location.href, origin)
      : null;
  const configurationError =
    origin && origin !== hostOrigin
      ? "This workspace uses a different Home Assistant server. Explicitly change the workspace server to use this host session."
      : transportError;

  useEffect(() => {
    setDetached(false);
  }, [connection, origin]);

  useEffect(() => {
    const base: HomeAssistantRuntimeSnapshot = {
      status: !origin
        ? "unconfigured"
        : configurationError
          ? "error"
          : detached
            ? "disconnected"
            : "connecting",
      configured: Boolean(origin),
      canMutate: false,
      origin,
      error: configurationError,
      areas: [],
      devices: [],
      entityRegistry: [],
      entityStates: EMPTY_STATES,
    };
    setState(base);
    setRefreshing(false);
    setRefreshError(null);
    if (!origin || configurationError || detached) return;
    let registryDeviceIds = new Map<string, string | null>();
    let request = 0;
    let transportReady = connection.connected !== false;
    const activity = new HomeAssistantActivityTracker();
    const subscriptions = new Set<() => void>();
    const attachment: Attachment = {
      active: true,
      connected: false,
      epoch: 0,
      subscriptions,
      scheduler: new DeviceCommandScheduler({
        dispatch: (call) =>
          attachment.active && attachment.connected
            ? client.callService(connection, call.domain, call.service, call.data, call.target)
            : Promise.reject(inactive()),
        resolveDeviceKey: (entityId) => registryDeviceIds.get(entityId) ?? `entity:${entityId}`,
      }),
      dispose: () => {
        attachment.active = false;
        attachment.connected = false;
        attachment.epoch++;
        attachment.scheduler.dispose();
        for (const unsubscribe of subscriptions) unsubscribe();
        subscriptions.clear();
        if (attachmentRef.current === attachment) attachmentRef.current = null;
      },
      refresh: async () => {
        if (!attachment.active) throw inactive();
        const epoch = attachment.epoch;
        const currentRequest = ++request;
        const current = () =>
          attachment.active && epoch === attachment.epoch && currentRequest === request;
        setRefreshing(true);
        setRefreshError(null);
        try {
          await registrySubscriptions;
          if (!current()) return;
          const [areas, devices, entityRegistry] = await Promise.all([
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
          if (!current()) return;
          registryDeviceIds = new Map(
            entityRegistry.map((entry) => [entry.entity_id, entry.device_id]),
          );
          attachment.connected = true;
          setState((previous) => ({
            ...previous,
            areas,
            devices,
            entityRegistry,
            status: "connected",
            canMutate: true,
            error: null,
          }));
        } catch (error) {
          if (!current()) return;
          attachment.connected = false;
          setRefreshError(homeAssistantErrorMessage(error));
          setState((previous) => ({
            ...previous,
            status: "error",
            canMutate: false,
            error: homeAssistantErrorMessage(error),
          }));
          throw error;
        } finally {
          if (current()) setRefreshing(false);
        }
      },
    };
    attachmentRef.current = attachment;
    const ready = () => {
      if (!attachment.active) return;
      if (!transportReady) activity.reset();
      transportReady = true;
      void attachment.refresh().catch(() => undefined);
    };
    const disconnected = () => {
      if (!attachment.active) return;
      attachment.epoch++;
      transportReady = false;
      activity.reset();
      attachment.connected = false;
      attachment.scheduler.cancelPendingValues();
      setRefreshing(false);
      setState((previous) => ({
        ...previous,
        status: "reconnecting",
        canMutate: false,
        entityStates: markEntityStatesStale(previous.entityStates),
      }));
    };
    const reconnectError = (_connection: unknown, error?: unknown) => {
      disconnected();
      if (attachment.active)
        setState((previous) => ({
          ...previous,
          status: "error",
          error: homeAssistantErrorMessage(error),
        }));
    };
    connection.addEventListener("ready", ready);
    connection.addEventListener("disconnected", disconnected);
    connection.addEventListener("reconnect-error", reconnectError);
    subscriptions.add(() => {
      connection.removeEventListener("ready", ready);
      connection.removeEventListener("disconnected", disconnected);
      connection.removeEventListener("reconnect-error", reconnectError);
    });
    subscriptions.add(
      client.subscribeEntities(connection, (states) => {
        if (!attachment.active) return;
        const snapshot = normalizeEntityStates(states, !transportReady);
        const entityStates = transportReady ? activity.update(snapshot) : snapshot;
        setState((previous) => ({ ...previous, entityStates }));
      }),
    );
    const registrySubscriptions = Promise.all(
      ["area_registry_updated", "device_registry_updated", "entity_registry_updated"].map((event) =>
        connection
          .subscribeEvents(() => {
            if (attachment.connected) ready();
          }, event)
          .then((unsubscribe) => {
            if (!attachment.active) void unsubscribe();
            else
              subscriptions.add(() => {
                void unsubscribe();
              });
          }),
      ),
    );
    // Observe failures even if the host is currently disconnected. Every later
    // refresh awaits this same promise; only an explicit reattach retries setup.
    void registrySubscriptions.catch((error) => {
      if (attachment.active) reconnectError(connection, error);
    });
    if (connection.connected === false) disconnected();
    else ready();
    return attachment.dispose;
  }, [client, connection, hostOrigin, origin, configurationError, detached, revision]);

  const attachment = attachmentRef.current;
  const epoch = attachment?.epoch;
  const connected = state.status === "connected";
  const operations = useMemo(() => {
    const current = () =>
      attachment && attachment.active && attachment.connected && epoch === attachment.epoch;
    const sendMessage = async <T,>(message: {
      type: string;
      [key: string]: unknown;
    }): Promise<T> => {
      if (!current()) throw inactive();
      const result = await connection.sendMessagePromise<T>(message);
      if (!current()) throw inactive();
      return result;
    };
    return {
      sendMessage,
      callService: (call: Parameters<HomeAssistantRuntimeValue["callService"]>[0]) =>
        current() ? attachment!.scheduler.schedule(call) : Promise.reject(inactive()),
      cameraClient: !connected
        ? null
        : {
            sendMessagePromise: sendMessage,
            subscribeMessage: async <T,>(
              callback: (message: T) => void,
              message: HomeAssistantCameraMessage,
              options?: { resubscribe?: boolean },
            ) => {
              if (!current()) throw inactive();
              const unsubscribe = await connection.subscribeMessage<T>(
                (value) => {
                  if (current()) callback(value);
                },
                message,
                options,
              );
              if (!current()) {
                void unsubscribe();
                throw inactive();
              }
              let subscribed = true;
              const release = () => {
                if (subscribed) {
                  subscribed = false;
                  attachment!.subscriptions.delete(release);
                  void unsubscribe();
                }
              };
              attachment!.subscriptions.add(release);
              return release;
            },
          },
    };
  }, [attachment, epoch, connection, connected]);
  const value = useMemo<HomeAssistantRuntimeValue>(
    () => ({
      ...state,
      refreshing,
      refreshError,
      connect: () => {
        setDetached(false);
        setRevision((value) => value + 1);
      },
      retry: () => {
        setDetached(false);
        setRevision((value) => value + 1);
      },
      disconnect: async () => {
        if (!attachment?.active) return;
        attachment.dispose();
        setDetached(true);
      },
      refresh: () => (attachment?.active ? attachment.refresh() : Promise.reject(inactive())),
      callService: operations.callService,
      sendStorageMessage: operations.sendMessage,
      cameraClient: operations.cameraClient,
    }),
    [state, refreshing, refreshError, attachment, operations],
  );
  return (
    <HomeAssistantRuntimeValueProvider value={value}>{children}</HomeAssistantRuntimeValueProvider>
  );
}
