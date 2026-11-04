import type { CameraSession } from "./camera-sessions/camera-session-types";
import type { EntityId } from "./types";

export interface HomeAssistantCameraMessage {
  type: string;
  [key: string]: unknown;
}

export interface HomeAssistantCameraClient {
  /** Optional in-memory source supplied by a host without an HA media transport. */
  openLocalStream?: (options: {
    entityId: EntityId;
    signal: AbortSignal;
    container: HTMLElement;
  }) => Promise<CameraSession>;
  sendMessagePromise: <T>(message: HomeAssistantCameraMessage) => Promise<T>;
  subscribeMessage: <T>(
    callback: (message: T) => void,
    message: HomeAssistantCameraMessage,
    options?: { resubscribe?: boolean },
  ) => Promise<() => void | Promise<void>>;
}
