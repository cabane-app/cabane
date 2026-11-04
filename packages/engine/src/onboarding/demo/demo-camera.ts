import type { HomeAssistantCameraClient } from "../../camera-runtime";
import {
  makeVideo,
  closeVideo,
  waitForFirstFrame,
  throwIfAborted,
} from "../../camera-sessions/camera-video-lifecycle";
import type { EntityId, EntityStateSnapshot } from "../../types";

/** Small local canvas feed, opened only for cameras requested by the dashboard. */
export function createDemoCameraClient(
  states: Readonly<Record<EntityId, EntityStateSnapshot>>,
  isActive: () => boolean,
): HomeAssistantCameraClient {
  const unavailable = () => new Error("This demo camera session is unavailable.");
  return {
    sendMessagePromise: async () => {
      throw unavailable();
    },
    subscribeMessage: async () => {
      throw unavailable();
    },
    openLocalStream: async ({ entityId, signal, container }) => {
      throwIfAborted(signal);
      const state = states[entityId];
      if (!isActive() || !entityId.startsWith("camera.") || !state?.available) throw unavailable();
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const context = canvas.getContext("2d");
      if (!context || typeof canvas.captureStream !== "function") throw unavailable();
      const started = performance.now();
      const paint = () => {
        const drift = Math.sin((performance.now() - started) / 2400) * 16;
        context.fillStyle = "#233d38";
        context.fillRect(0, 0, 640, 360);
        // Stylized garden courtyard, with a moving highlight to show a live feed.
        context.fillStyle = "#b9c9b8";
        context.fillRect(0, 55, 640, 145);
        context.fillStyle = "#b7a68a";
        context.fillRect(0, 200, 640, 160);
        context.fillStyle = "#678b82";
        context.fillRect(195, 215, 275, 92);
        context.fillStyle = "#c3ded5";
        context.fillRect(210 + drift, 233, 175, 4);
        for (const x of [75, 555]) {
          context.fillStyle = "#6c5842";
          context.fillRect(x - 5, 105, 10, 140);
          context.fillStyle = "#526e4a";
          context.beginPath();
          context.ellipse(x, 110, 50, 65, 0, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = "rgba(12, 28, 24, .85)";
        context.fillRect(0, 0, 640, 55);
        context.fillRect(0, 320, 640, 40);
        context.fillStyle = "#f2eedc";
        context.font = "600 20px sans-serif";
        context.fillText("SIMULATED DEMO · GARDEN", 20, 34);
        context.font = "16px sans-serif";
        const label = state.attributes.friendly_name;
        context.fillText(typeof label === "string" ? label.slice(0, 55) : "Camera", 20, 346);
      };
      paint();
      const stream = canvas.captureStream(8);
      const video = makeVideo(false, container);
      video.srcObject = stream;
      const timer = globalThis.setInterval(paint, 125);
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        globalThis.clearInterval(timer);
        stream.getTracks().forEach((track) => track.stop());
        closeVideo(video);
        signal.removeEventListener("abort", close);
      };
      signal.addEventListener("abort", close, { once: true });
      try {
        throwIfAborted(signal);
        void video.play().catch(() => undefined);
        await waitForFirstFrame(video, signal);
        if (!isActive()) throw unavailable();
        return { video, transport: "local", close };
      } catch (error) {
        close();
        throw error;
      }
    },
  };
}
