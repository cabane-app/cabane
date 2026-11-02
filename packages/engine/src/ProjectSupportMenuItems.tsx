import { SceneMenuIcon } from "./SceneMenuIcon";

export function ProjectSupportMenuItems() {
  return (
    <>
      <a
        href="https://github.com/cabane-app/cabane/issues/new/choose"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Send feedback (opens in a new tab)"
        onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
      >
        <SceneMenuIcon name="feedback" />
        <span>Send feedback</span>
      </a>
      <a
        href="https://paypal.me/hilliaapp"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy me a coffee via PayPal (opens in a new tab)"
        onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
      >
        <SceneMenuIcon name="coffee" />
        <span>Buy me a coffee</span>
      </a>
    </>
  );
}
