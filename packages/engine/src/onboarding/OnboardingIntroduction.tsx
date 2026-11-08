import { useEffect, useRef, type Ref } from "react";
import { OnboardingPrivacy } from "./OnboardingPrivacy";

export interface OnboardingLinks {
  source: string;
}

export interface OnboardingPreviewControls {
  mode: "orbit" | "walk";
  playing: boolean;
  walkAvailable?: boolean;
  orbitStage?: "Ground floor" | "Upstairs" | "Roof" | undefined;
  progressRef?: Ref<HTMLSpanElement> | undefined;
  setMode: (mode: "orbit" | "walk") => void;
  togglePlaying: () => void;
}

export function OnboardingIntroduction({
  onExplore,
  onBuild,
  onDismiss,
  busy,
  error,
  links,
  preview,
}: {
  onExplore: () => void;
  onBuild: () => void;
  onDismiss: () => void;
  busy: boolean;
  error: string | null;
  links?: OnboardingLinks | undefined;
  preview?: OnboardingPreviewControls | undefined;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, []);
  const stage = preview?.mode === "orbit" ? preview.orbitStage : undefined;
  const showWalkHint = preview?.mode === "walk" && !preview.playing;
  return (
    <section className="onboarding-intro" aria-labelledby="onboarding-title" aria-busy={busy}>
      <header className="onboarding-intro__top">
        <span className="onboarding-wordmark">
          cabane<span aria-hidden="true">.</span>
        </span>
        <nav aria-label="Welcome links">
          {links && (
            <a href={links.source} target="_blank" rel="noreferrer">
              Source code <ExternalArrow />
            </a>
          )}
          <button
            type="button"
            className="onboarding-skip"
            onClick={onDismiss}
            disabled={busy}
            aria-label="Dismiss introduction"
          >
            Skip intro
          </button>
        </nav>
      </header>
      <div className="onboarding-intro__body">
        <p className="onboarding-eyebrow">A home for Home Assistant</p>
        <h1 ref={title} tabIndex={-1} id="onboarding-title">
          Your home.
          <br />
          In your hands.
        </h1>
        <p className="onboarding-intro__description">
          Build your rooms in 3D. Connect your devices. See your home respond.
        </p>
        <div className="onboarding-entry-actions">
          <button type="button" className="is-primary" onClick={onExplore} disabled={busy}>
            Explore the demo <span aria-hidden="true">→</span>
          </button>
          <button type="button" onClick={onBuild} disabled={busy}>
            Build my home
          </button>
        </div>
        <p className="onboarding-intro__reassurance">No account. No connection needed to try.</p>
        {error && (
          <p className="onboarding-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="onboarding-demo-label">
        <span aria-hidden="true" />
        Live 3D demo{" "}
        <span className="onboarding-demo-label__detail">
          ·{" "}
          {showWalkHint ? (
            <>
              <span className="onboarding-walk-hint__keyboard">WASD to walk</span>
              <span className="onboarding-walk-hint__touch">Hold to walk</span>
            </>
          ) : (
            (stage ?? "Simulated devices")
          )}
        </span>
      </div>
      {preview && <PreviewControls preview={preview} />}
      <footer className="onboarding-intro__footer">
        <div className="onboarding-method" aria-label="Construct, Arrange, Connect">
          <span>
            <b>Construct</b> your rooms
          </span>
          <span>
            <b>Arrange</b> your furniture
          </span>
          <span>
            <b>Connect</b> your devices
          </span>
        </div>
        <div className="onboarding-intro__privacy">
          <OnboardingPrivacy />
        </div>
      </footer>
    </section>
  );
}

function ExternalArrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
      <path d="M8.5 2.5h5v5m0-5-7 7M6.5 4.5h-4v9h9v-4" stroke="currentColor" />
    </svg>
  );
}

function PreviewControls({ preview }: { preview: OnboardingPreviewControls }) {
  return (
    <div className="onboarding-preview-controls" role="group" aria-label="Demo camera">
      <button
        type="button"
        aria-pressed={preview.mode === "walk"}
        onClick={() => preview.setMode("walk")}
        disabled={preview.walkAvailable === false}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <circle cx="11.5" cy="3.5" r="1.5" />
          <path d="m6 10 2-2.5 2.5-.5 2 3.5H15m-4.5-3.5-2 5 3 1.5V18m-3-6-2 4-2 2" />
        </svg>
        Walk
        <span aria-hidden="true" className="onboarding-preview-progress">
          {preview.mode === "walk" && <span ref={preview.progressRef} />}
        </span>
      </button>
      <button
        type="button"
        aria-pressed={preview.mode === "orbit"}
        onClick={() => preview.setMode("orbit")}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <circle cx="10" cy="10" r="3" />
          <ellipse cx="10" cy="10" rx="8" ry="4" transform="rotate(-26 10 10)" />
        </svg>
        Orbit
        <span aria-hidden="true" className="onboarding-preview-progress">
          {preview.mode === "orbit" && <span ref={preview.progressRef} />}
        </span>
      </button>
      <button
        className="onboarding-preview-motion"
        type="button"
        aria-label={preview.playing ? "Pause camera motion" : "Play camera motion"}
        title={preview.playing ? "Pause camera motion" : "Play camera motion"}
        onClick={preview.togglePlaying}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor">
          {preview.playing ? <path d="M7 5v10m6-10v10" /> : <path d="m7 4 9 6-9 6z" />}
        </svg>
      </button>
    </div>
  );
}
