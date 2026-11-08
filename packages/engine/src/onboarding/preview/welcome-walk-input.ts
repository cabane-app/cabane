import type { StickVector } from "../../navigation/walk-navigation-contract";

const MOVE_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
]);
export const WELCOME_WALK_HOLD_MS = 350;
const TOUCH_SLOP = 8;

export function bindWelcomeWalkInput(
  canvas: HTMLCanvasElement,
  onMove: (input: StickVector) => void,
  onLook: (dx: number, dy: number) => void,
) {
  const keys = new Set<string>();
  const view = canvas.ownerDocument.defaultView;
  const previousLabel = canvas.getAttribute("aria-label");
  canvas.setAttribute(
    "aria-label",
    "Walk preview. Use WASD or the arrow keys to move. Press Enter for full demo options.",
  );

  let pointer: {
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    holding: boolean;
  } | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;

  const publishMovement = () => {
    const left = keys.has("KeyA") || keys.has("ArrowLeft");
    const right = keys.has("KeyD") || keys.has("ArrowRight");
    const forward = keys.has("KeyW") || keys.has("ArrowUp") || Boolean(pointer?.holding);
    const back = keys.has("KeyS") || keys.has("ArrowDown");
    onMove({ x: Number(right) - Number(left), y: Number(back) - Number(forward) });
  };
  const keyDown = (event: KeyboardEvent) => {
    if (!MOVE_KEYS.has(event.code) || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (keys.has(event.code)) return;
    keys.add(event.code);
    publishMovement();
  };
  const keyUp = (event: KeyboardEvent) => {
    if (!keys.delete(event.code)) return;
    event.preventDefault();
    event.stopPropagation();
    publishMovement();
  };

  const start = (event: PointerEvent) => {
    if (pointer || !event.isPrimary || event.button !== 0) return;
    const { pointerId: id, clientX: x, clientY: y } = event;
    pointer = { id, x, y, startX: x, startY: y, holding: false };
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(id);
    if (event.pointerType !== "touch") return;
    holdTimer = setTimeout(() => {
      if (pointer?.id !== id) return;
      pointer.holding = true;
      publishMovement();
    }, WELCOME_WALK_HOLD_MS);
  };
  const move = (event: PointerEvent) => {
    if (pointer?.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > TOUCH_SLOP)
      clearTimeout(holdTimer);
    onLook(event.clientX - pointer.x, event.clientY - pointer.y);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  };
  const end = (event: PointerEvent) => {
    if (pointer?.id !== event.pointerId) return;
    const wasHolding = pointer.holding;
    clearTimeout(holdTimer);
    pointer = null;
    if (wasHolding) publishMovement();
  };
  const reset = () => {
    clearTimeout(holdTimer);
    pointer = null;
    keys.clear();
    publishMovement();
  };
  const contextMenu = (event: MouseEvent) => {
    if (pointer?.holding) event.preventDefault();
  };

  canvas.addEventListener("keydown", keyDown);
  canvas.addEventListener("keyup", keyUp);
  canvas.addEventListener("blur", reset);
  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("lostpointercapture", end);
  canvas.addEventListener("contextmenu", contextMenu);
  view?.addEventListener("blur", reset);
  return () => {
    canvas.removeEventListener("keydown", keyDown);
    canvas.removeEventListener("keyup", keyUp);
    canvas.removeEventListener("blur", reset);
    canvas.removeEventListener("pointerdown", start);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", end);
    canvas.removeEventListener("pointercancel", end);
    canvas.removeEventListener("lostpointercapture", end);
    canvas.removeEventListener("contextmenu", contextMenu);
    view?.removeEventListener("blur", reset);
    if (previousLabel === null) canvas.removeAttribute("aria-label");
    else canvas.setAttribute("aria-label", previousLabel);
    reset();
  };
}
