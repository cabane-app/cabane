import type { Ref } from "react";

export function WelcomeDemoInvitation({
  busy,
  onExplore,
  onDismiss,
  panelRef,
}: {
  busy: boolean;
  onExplore: () => void;
  onDismiss: () => void;
  panelRef?: Ref<HTMLElement> | undefined;
}) {
  return (
    <aside ref={panelRef} className="welcome-invitation" aria-label="Demo invitation">
      <svg className="welcome-invitation__door" viewBox="0 0 52 56" aria-hidden="true">
        <path d="M7 49h38M12 47V8h28v39" fill="none" stroke="currentColor" />
        <path d="M16 12h20v35H16z" fill="#ded8c5" />
        <g className="welcome-invitation__door-leaf">
          <path d="M16 12h20v35H16z" fill="#b87555" stroke="#865034" />
          <path d="M20 16h12v12H20zM20 33h12v10H20z" fill="none" stroke="#f3efe5" />
          <circle cx="32" cy="30.5" r="1" fill="#f3efe5" />
        </g>
      </svg>
      <div className="welcome-invitation__copy">
        <p>Ready to try the full demo?</p>
        <button
          className="welcome-invitation__open"
          type="button"
          onClick={onExplore}
          disabled={busy}
        >
          Open demo home <span aria-hidden="true">→</span>
        </button>
      </div>
      <button
        className="welcome-invitation__dismiss"
        type="button"
        aria-label="Dismiss demo invitation"
        onClick={onDismiss}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
    </aside>
  );
}
