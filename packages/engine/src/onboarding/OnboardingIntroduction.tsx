import { useEffect, useRef } from "react";
import { OnboardingPrivacy } from "./OnboardingPrivacy";

export interface OnboardingLinks {
  source: string;
  selfHost: string;
  available?: boolean;
}
export function OnboardingIntroduction({
  onExplore,
  onBuild,
  onDismiss,
  busy,
  error,
  links,
}: {
  onExplore: () => void;
  onBuild: () => void;
  onDismiss: () => void;
  busy: boolean;
  error: string | null;
  links?: OnboardingLinks | undefined;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className="onboarding-intro" aria-labelledby="onboarding-title" aria-busy={busy}>
      <header className="onboarding-intro__top">
        <span className="onboarding-wordmark">
          cabane<span aria-hidden="true">.</span>
        </span>
        <nav aria-label="Source and self-hosting">
          {links && links.available !== false && (
            <>
              <a href={links.source} target="_blank" rel="noreferrer">
                Source code <span aria-hidden="true">↗</span>
              </a>
              <a href={links.selfHost} target="_blank" rel="noreferrer">
                Self-hosting <span aria-hidden="true">↗</span>
              </a>
            </>
          )}
          <button
            type="button"
            className="onboarding-skip"
            onClick={onDismiss}
            disabled={busy}
            aria-label="Dismiss introduction"
          >
            Skip intro <span aria-hidden="true">↗</span>
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
          Build your rooms in 3D. Connect your devices.
          <br className="onboarding-desktop-break" /> See your home respond.
        </p>
        <div className="onboarding-entry-actions">
          <button type="button" className="is-primary" onClick={onExplore} disabled={busy}>
            Explore the demo <span aria-hidden="true">→</span>
          </button>
          <button type="button" onClick={onBuild} disabled={busy}>
            Build my home <span aria-hidden="true">↗</span>
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
        Live 3D demo <span className="onboarding-demo-label__detail">/ Simulated devices</span>
      </div>
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
          <p>Your home stays in your browser.</p>
          <OnboardingPrivacy />
        </div>
      </footer>
    </section>
  );
}
