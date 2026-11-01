/** Call during the entry click so browsers retain transient user activation. */
export function requestWalkPointerLock(target: HTMLElement): Promise<void> {
  const root = target.getRootNode() as Document | ShadowRoot;
  const focus = () => {
    // Pointer lock does not move keyboard focus into an embedded panel. Focus
    // the persistent scene, since the entry button can disappear during Explore.
    if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  };
  if (root.pointerLockElement === target) {
    focus();
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      document.removeEventListener("pointerlockchange", changed);
      document.removeEventListener("pointerlockerror", failed);
    };
    const failed = () => {
      cleanup();
      reject(new Error("Pointer lock was not granted."));
    };
    const changed = () => {
      if (root.pointerLockElement !== target) return;
      cleanup();
      resolve();
    };
    const timeout = setTimeout(failed, 5000);
    document.addEventListener("pointerlockchange", changed);
    document.addEventListener("pointerlockerror", failed);
    try {
      if (!target.requestPointerLock) {
        failed();
        return;
      }
      // Older browsers return void and report completion through events.
      const request = (target.requestPointerLock as () => Promise<void> | void)();
      if (request) void request.then(changed, failed);
    } catch {
      failed();
    }
  }).then(focus);
}
