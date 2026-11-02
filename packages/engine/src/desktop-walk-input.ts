import { useCabaneDom } from "./CabaneDom";
import { useEffect, type MutableRefObject } from "react";

import { type StickVector } from "./navigation";

export const useDesktopWalkInput = (
  active: boolean,
  movementRef: MutableRefObject<StickVector>,
  sprintRef: MutableRefObject<boolean>,
  jumpRequestRef?: MutableRefObject<boolean>,
) => {
  const dom = useCabaneDom();
  useEffect(() => {
    if (!active) return;
    const keys = new Set<string>();
    const update = () => {
      sprintRef.current = keys.has("ShiftLeft") || keys.has("ShiftRight");
      const left = keys.has("KeyA") || keys.has("ArrowLeft");
      const right = keys.has("KeyD") || keys.has("ArrowRight");
      const forward = keys.has("KeyW") || keys.has("ArrowUp");
      const backward = keys.has("KeyS") || keys.has("ArrowDown");
      movementRef.current = {
        x: Number(right) - Number(left),
        y: Number(backward) - Number(forward),
      };
    };
    const down = (event: KeyboardEvent) => {
      const target = event.composedPath()[0] ?? event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select"))
      )
        return;
      // HA listens above the panel's shadow root. Keep every walking key local,
      // including keys such as E that only the host would otherwise handle.
      event.stopPropagation();
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat && !keys.has("Space") && jumpRequestRef) jumpRequestRef.current = true;
        keys.add("Space");
        return;
      }
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "ShiftLeft",
          "ShiftRight",
        ].includes(event.code)
      ) {
        event.preventDefault();
        keys.add(event.code);
        update();
      }
    };
    const up = (event: KeyboardEvent) => {
      event.stopPropagation();
      keys.delete(event.code);
      update();
    };
    const reset = () => {
      keys.clear();
      if (jumpRequestRef) jumpRequestRef.current = false;
      update();
    };
    const focusOut = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof HTMLElement) || !dom.root.contains(event.relatedTarget))
        reset();
    };
    dom.events.addEventListener("focusout", focusOut);
    dom.events.addEventListener("keydown", down);
    dom.events.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      dom.events.removeEventListener("focusout", focusOut);
      dom.events.removeEventListener("keydown", down);
      dom.events.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
      reset();
    };
  }, [active, movementRef, sprintRef, jumpRequestRef, dom]);
};
