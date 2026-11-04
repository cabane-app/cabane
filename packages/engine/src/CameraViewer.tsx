import { useCabaneDom } from "./CabaneDom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DeviceLiveMedia } from "./types";

const CameraGlyph = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="10" y="18" width="34" height="28" rx="7" />
    <circle cx="27" cy="32" r="8" />
    <path d="m44 26 10-5v22l-10-5" />
  </svg>
);

const CloseGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m7 7 10 10M17 7 7 17" />
  </svg>
);

const SoundGlyph = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 9v6h4l5 4V5L9 9H5Z" />
    {muted ? (
      <path d="m18 9 4 4m0-4-4 4" />
    ) : (
      <path d="M17 9.5a4 4 0 0 1 0 5M19 7a7 7 0 0 1 0 10" />
    )}
  </svg>
);

const statusLabel = (media: DeviceLiveMedia | undefined) => {
  if (media?.state === "playing") return "Live";
  if (media?.state === "connecting") return "Connecting…";
  if (media?.state === "error") return "Feed interrupted";
  return "Offline";
};

const emptyState = (media: DeviceLiveMedia | undefined) => {
  if (media?.state === "connecting")
    return {
      title: "Opening the live feed",
      detail: "Connecting securely through Home Assistant…",
    };
  if (media?.state === "error")
    return {
      title: "Live feed unavailable",
      detail: "Home Assistant could not open the stream. Another attempt will start automatically.",
    };
  return {
    title: "Camera offline",
    detail: "The live feed will start automatically when the camera becomes available.",
  };
};

export function CameraViewer({
  roomName,
  label,
  media,
  onClose,
  onReviewConnections,
}: {
  roomName: string;
  label: string;
  media?: DeviceLiveMedia | undefined;
  onClose: () => void;
  onReviewConnections: () => void;
}) {
  const dom = useCabaneDom();
  const viewerRef = useRef<HTMLElement>(null);
  const videoSlotRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const playing = media?.state === "playing" && Boolean(media.video);
  const fallback = emptyState(media);

  useLayoutEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return undefined;
    const previousFocus =
      dom.root.activeElement instanceof HTMLElement ? dom.root.activeElement : null;
    const parent = viewer.parentElement;
    const siblings = parent
      ? [...parent.children].filter(
          (element): element is HTMLElement => element instanceof HTMLElement && element !== viewer,
        )
      : [];
    const previousStates = siblings.map((element) => ({
      element,
      inert: Boolean(element.inert),
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    siblings.forEach((element) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    const previousOverflow = dom.container.style.overflow;
    dom.container.style.overflow = "hidden";
    viewer.querySelector<HTMLElement>("[data-camera-close]")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...viewer.querySelectorAll<HTMLElement>(
          "button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])",
        ),
      ];
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && dom.root.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && dom.root.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dom.events.addEventListener("keydown", onKeyDown);
    return () => {
      dom.events.removeEventListener("keydown", onKeyDown);
      dom.container.style.overflow = previousOverflow;
      previousStates.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      previousFocus?.focus();
    };
  }, [onClose, dom]);

  useEffect(() => {
    const video = media?.video;
    const slot = videoSlotRef.current;
    if (!video || !slot) return undefined;
    video.className = "camera-viewer__video";
    video.removeAttribute("aria-hidden");
    delete video.dataset.cameraClosed;
    video.controls = false;
    slot.appendChild(video);
    void video.play().catch(() => undefined);
    return () => {
      video.muted = true;
      if (video.dataset.cameraClosed === "true") {
        video.remove();
        return;
      }
      video.className = "camera-stream-video is-parked";
      video.setAttribute("aria-hidden", "true");
      dom.container.appendChild(video);
    };
  }, [media?.video, dom]);

  useEffect(() => {
    if (media?.video) media.video.muted = muted;
  }, [media?.video, muted]);

  return (
    <aside
      ref={viewerRef}
      className={`camera-viewer is-${media?.state ?? "idle"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-viewer-title"
    >
      <div
        className="camera-viewer__stage"
        style={media?.posterUrl ? { backgroundImage: `url(${media.posterUrl})` } : undefined}
      >
        <div ref={videoSlotRef} className="camera-viewer__video-slot" />
        {!playing && (
          <div className="camera-viewer__offline">
            <span>
              <CameraGlyph />
            </span>
            <strong>{fallback.title}</strong>
            <p>{fallback.detail}</p>
          </div>
        )}
        <div className="camera-viewer__vignette" />
      </div>

      <header className="camera-viewer__header">
        <button
          type="button"
          className="camera-viewer__round-button"
          data-camera-close
          onClick={onClose}
          aria-label="Close live feed"
        >
          <CloseGlyph />
        </button>
        <div className="camera-viewer__identity">
          <span>{roomName}</span>
          <h2 id="camera-viewer-title">{label}</h2>
        </div>
        <span className={`camera-viewer__status is-${media?.state ?? "idle"}`}>
          <i aria-hidden="true" />
          {statusLabel(media)}
        </span>
      </header>

      <footer className="camera-viewer__controls">
        <div className="camera-viewer__meta">
          <span>
            {media?.transport === "hls"
              ? "Home Assistant · HLS"
              : media?.transport === "webrtc"
                ? "Home Assistant · WebRTC"
                : media?.transport === "local"
                  ? "Local simulated camera"
                  : "Home Assistant live camera"}
          </span>
          {media?.previewState === "cors-blocked" && <small>{media.error}</small>}
        </div>
        <div className="camera-viewer__actions">
          {!playing && (
            <button type="button" className="camera-viewer__review" onClick={onReviewConnections}>
              Review connection
            </button>
          )}
          <button
            type="button"
            className="camera-viewer__sound"
            onClick={() => setMuted((current) => !current)}
            disabled={!playing}
            aria-pressed={!muted}
            aria-label={muted ? "Turn on camera sound" : "Mute camera sound"}
          >
            <SoundGlyph muted={muted} />
            <span>{muted ? "Sound" : "Mute"}</span>
          </button>
        </div>
      </footer>
    </aside>
  );
}
