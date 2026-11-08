import { events, type RootStore } from "@react-three/fiber";

/** Canvas configuration can finish after React has detached its event element. */
export function connectedCanvasEvents(store: RootStore) {
  const manager = events(store);
  const connect = manager.connect;
  manager.connect = (target) => {
    if (!target?.isConnected) return;
    connect?.(target);
  };
  return manager;
}

/** HTML overlays share the controls' event host, but own their own presses. */
export function dashboardCanvasEvents(store: RootStore) {
  const manager = connectedCanvasEvents(store);
  const handlers = manager.handlers;
  if (!handlers) return manager;
  for (const type of ["onPointerDown", "onPointerUp"] as const) {
    const handle = handlers[type];
    handlers[type] = (event) => {
      if (event.target === store.getState().gl.domElement) handle(event);
    };
  }
  return manager;
}
