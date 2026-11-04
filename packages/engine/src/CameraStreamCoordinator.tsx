import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useCabaneDom } from "./CabaneDom";
import type { HomeAssistantCameraClient } from "./camera-runtime";

import {
  CAMERA_DISCONNECT_RETRY_MS,
  CAMERA_ERROR_RETRY_MS,
  CAMERA_FIRST_FRAME_TIMEOUT_MS,
  CAMERA_HLS_FIRST_FRAME_TIMEOUT_MS,
  cameraTextureIsSafe,
  cameraTransportCandidates,
  preferHlsForRemoteAppleClient,
  runCameraAttempt,
  runCameraTransportRace,
} from "./camera-stream";

import { openHlsSession } from "./camera-sessions/camera-hls-session";
import {
  CameraCapabilities,
  CameraSession,
  CameraStreamRequirement,
  CameraStreamsByEntityId,
} from "./camera-sessions/camera-session-types";
import { waitWithSignal } from "./camera-sessions/camera-video-lifecycle";
import { openWebRtcSession } from "./camera-sessions/camera-webrtc-session";
import type { CameraTransport, DeviceLiveMedia, EntityId } from "./types";

const initialMedia = (posterUrl: string | null): DeviceLiveMedia => ({
  kind: "camera-stream",
  video: null,
  posterUrl,
  state: "idle",
  transport: null,
  previewState: "poster",
  error: null,
});

const capturePoster = (video: HTMLVideoElement | null) => {
  if (!video || !cameraTextureIsSafe(video)) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth || 640, 960);
    canvas.height = Math.round(
      (canvas.width * (video.videoHeight || 360)) / (video.videoWidth || 640),
    );
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
};

function CameraStreamSource({
  requirement,
  client,
  origin,
  documentVisible,
  onChange,
}: {
  requirement: CameraStreamRequirement;
  client: HomeAssistantCameraClient | null;
  origin: string | null;
  documentVisible: boolean;
  onChange: (entityId: EntityId, media: DeviceLiveMedia) => void;
}) {
  const { container } = useCabaneDom();
  const sessionRef = useRef<CameraSession | null>(null);
  const posterRef = useRef(requirement.posterUrl);
  const [retryKey, setRetryKey] = useState(0);
  const [media, setMedia] = useState<DeviceLiveMedia>(() => initialMedia(requirement.posterUrl));

  useEffect(() => {
    posterRef.current = requirement.posterUrl ?? posterRef.current;
    setMedia((current) =>
      current.posterUrl === posterRef.current
        ? current
        : { ...current, posterUrl: posterRef.current },
    );
  }, [requirement.posterUrl]);

  useEffect(() => onChange(requirement.entityId, media), [media, onChange, requirement.entityId]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
    const lifecycle = new AbortController();
    const previous = sessionRef.current;
    posterRef.current = capturePoster(previous?.video ?? null) ?? posterRef.current;
    previous?.close();
    sessionRef.current = null;

    const sourceAvailable = Boolean(client && (origin || client.openLocalStream));
    if (!client || !sourceAvailable || !documentVisible || !requirement.available) {
      setMedia({
        ...initialMedia(posterRef.current),
        state: sourceAvailable && documentVisible ? "unavailable" : "idle",
      });
      return () => {
        cancelled = true;
      };
    }

    setMedia({
      ...initialMedia(posterRef.current),
      state: "connecting",
    });
    const reconnect = (delay: number) => {
      if (cancelled) return;
      retryTimer = globalThis.setTimeout(() => setRetryKey((current) => current + 1), delay);
    };
    const disconnected = () => {
      if (cancelled) return;
      posterRef.current = capturePoster(sessionRef.current?.video ?? null) ?? posterRef.current;
      sessionRef.current?.close();
      sessionRef.current = null;
      setMedia({ ...initialMedia(posterRef.current), state: "connecting" });
      reconnect(CAMERA_DISCONNECT_RETRY_MS);
    };
    const presentConnectingVideo = (video: HTMLVideoElement, transport: CameraTransport) => {
      if (cancelled) return;
      setMedia({
        ...initialMedia(posterRef.current),
        video,
        state: "connecting",
        transport,
      });
    };

    const connect = async () => {
      try {
        const openRemoteStream = async () => {
          if (!origin) throw new Error("No camera origin is available.");
          const capabilities = await runCameraAttempt(
            (signal) =>
              waitWithSignal(
                client.sendMessagePromise<CameraCapabilities>({
                  type: "camera/capabilities",
                  entity_id: requirement.entityId,
                }),
                signal,
              ),
            CAMERA_FIRST_FRAME_TIMEOUT_MS,
            lifecycle.signal,
          );
          const preferHls = preferHlsForRemoteAppleClient(
            window.location.href,
            origin,
            window.navigator.userAgent,
          );
          const transports = cameraTransportCandidates(
            capabilities.frontend_stream_types,
            preferHls,
            typeof RTCPeerConnection !== "undefined",
          );
          return runCameraTransportRace(
            transports,
            (transport, signal) =>
              runCameraAttempt(
                (attemptSignal) =>
                  transport === "webrtc"
                    ? openWebRtcSession(
                        client,
                        requirement.entityId,
                        disconnected,
                        presentConnectingVideo,
                        attemptSignal,
                        container,
                      )
                    : openHlsSession(
                        client,
                        requirement.entityId,
                        origin,
                        disconnected,
                        presentConnectingVideo,
                        attemptSignal,
                        container,
                      ),
                transport === "hls"
                  ? CAMERA_HLS_FIRST_FRAME_TIMEOUT_MS
                  : CAMERA_FIRST_FRAME_TIMEOUT_MS,
                signal,
              ),
            undefined,
            lifecycle.signal,
          );
        };
        const openLocalStream = client.openLocalStream;
        const session = openLocalStream
          ? await runCameraAttempt(
              (signal) => openLocalStream({ entityId: requirement.entityId, signal, container }),
              CAMERA_FIRST_FRAME_TIMEOUT_MS,
              lifecycle.signal,
            )
          : await openRemoteStream();
        if (cancelled) {
          session.close();
          return;
        }
        sessionRef.current = session;
        const textureSafe = cameraTextureIsSafe(session.video);
        setMedia({
          kind: "camera-stream",
          video: session.video,
          posterUrl: posterRef.current,
          state: "playing",
          transport: session.transport,
          previewState: textureSafe ? "live" : "cors-blocked",
          error: textureSafe
            ? null
            : "Live 3D preview needs this dashboard origin in Home Assistant HTTP CORS settings.",
        });
      } catch {
        if (cancelled) return;
        setMedia({
          ...initialMedia(posterRef.current),
          state: "error",
          error: "The live feed is unavailable. Retrying automatically.",
        });
        reconnect(CAMERA_ERROR_RETRY_MS);
      }
    };
    void connect();

    return () => {
      cancelled = true;
      lifecycle.abort(new Error("Camera connection interrupted."));
      if (retryTimer !== undefined) globalThis.clearTimeout(retryTimer);
      sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, [
    container,
    client,
    documentVisible,
    origin,
    requirement.available,
    requirement.entityId,
    retryKey,
  ]);

  useEffect(() => () => sessionRef.current?.close(), []);
  return null;
}

export function CameraStreamCoordinator({
  requirements,
  client,
  origin,
  documentVisible,
  children,
}: {
  requirements: readonly CameraStreamRequirement[];
  client: HomeAssistantCameraClient | null;
  origin: string | null;
  documentVisible: boolean;
  children: (streams: CameraStreamsByEntityId) => ReactNode;
}) {
  const [streams, setStreams] = useState<Partial<Record<EntityId, DeviceLiveMedia>>>({});
  const activeIds = useMemo(
    () => new Set(requirements.map((requirement) => requirement.entityId)),
    [requirements],
  );
  useEffect(() => {
    setStreams((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entityId]) => activeIds.has(entityId as EntityId)),
      ),
    );
  }, [activeIds]);
  const update = useCallback((entityId: EntityId, media: DeviceLiveMedia) => {
    setStreams((current) =>
      current[entityId] === media ? current : { ...current, [entityId]: media },
    );
  }, []);
  return (
    <>
      {requirements.map((requirement) => (
        <CameraStreamSource
          key={requirement.entityId}
          requirement={requirement}
          client={client}
          origin={origin}
          documentVisible={documentVisible}
          onChange={update}
        />
      ))}
      {children(streams)}
    </>
  );
}
export type {
  CameraStreamRequirement,
  CameraStreamsByEntityId,
} from "./camera-sessions/camera-session-types";
