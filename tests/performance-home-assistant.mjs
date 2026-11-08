const accessToken = "cabane-performance-fixture";
const haVersion = "2026.10.0";

/** Simulate the HA server boundary while keeping the app's real client and subscriptions. */
export function installPerformanceHomeAssistant(area, lights) {
  const nativeSocket = window.WebSocket;
  // Match the standalone transport policy for HTTPS and local HTTP. Requests
  // to this endpoint are intercepted in memory before the browser opens a socket.
  const origin =
    window.location.protocol === "https:"
      ? "https://cabane-benchmark.invalid"
      : "http://127.0.0.1:65535";
  const fixtureSocketUrl = `${origin.replace(/^http/, "ws")}/api/websocket`;
  const states = Object.fromEntries(lights.map((light) => [light.entityId, light.initialState]));
  const brightness = Object.fromEntries(
    lights.filter((light) => light.dimmable).map((light) => [light.entityId, 255]),
  );
  const registry = lights.map(({ entityId, label }) => ({
    entity_id: entityId,
    area_id: area.areaId,
    device_id: null,
    platform: "benchmark",
    name: label,
    original_name: label,
    disabled_by: null,
    hidden_by: null,
  }));
  const calls = [];

  class FixtureSocket extends EventTarget {
    OPEN = nativeSocket.OPEN;
    readyState = nativeSocket.CONNECTING;
    #entities = new Set();

    constructor() {
      super();
      queueMicrotask(() => {
        this.readyState = this.OPEN;
        this.dispatchEvent(new Event("open"));
      });
    }

    #deliver(message) {
      if (this.readyState === this.OPEN)
        this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }));
    }

    send(data) {
      const message = JSON.parse(data);
      queueMicrotask(() => this.#handle(message));
    }

    #handle(message) {
      if (this.readyState !== this.OPEN) return;
      const { id, type } = message;
      const result = (value) => this.#deliver({ id, type: "result", success: true, result: value });
      const fail = (code) =>
        this.#deliver({ id, type: "result", success: false, error: { code, message: type } });
      const entityEvent = (subscription, event) =>
        this.#deliver({ id: subscription, type: "event", event });

      switch (type) {
        case "auth":
          this.#deliver({
            type: message.access_token === accessToken ? "auth_ok" : "auth_invalid",
            ha_version: haVersion,
          });
          break;
        case "supported_features":
        case "subscribe_events":
          result(null);
          break;
        case "unsubscribe_events":
          this.#entities.delete(message.subscription);
          result(null);
          break;
        case "subscribe_entities":
          this.#entities.add(id);
          result(null);
          entityEvent(id, {
            a: Object.fromEntries(
              lights.map(({ entityId, label, dimmable }) => {
                const colorMode = dimmable ? "brightness" : "onoff";
                return [
                  entityId,
                  {
                    s: states[entityId],
                    a: {
                      friendly_name: label,
                      supported_color_modes: [colorMode],
                      color_mode: colorMode,
                      ...(dimmable ? { brightness: brightness[entityId] } : {}),
                    },
                    c: "benchmark",
                    lc: Date.now() / 1000,
                  },
                ];
              }),
            ),
          });
          break;
        case "config/area_registry/list":
          result([{ area_id: area.areaId, name: area.name }]);
          break;
        case "config/entity_registry/list":
          result(registry);
          break;
        case "config/device_registry/list":
        case "cabane/workspaces/list":
          result([]);
          break;
        case "call_service": {
          const { domain, service } = message;
          const entity = message.target?.entity_id ?? message.service_data?.entity_id;
          const entityIds = Array.isArray(entity) ? entity : [entity];
          const brightnessPct = message.service_data?.brightness_pct;
          if (
            domain !== "light" ||
            !["turn_on", "turn_off", "toggle"].includes(service) ||
            !entityIds.length ||
            entityIds.some((id) => !Object.hasOwn(states, id)) ||
            (brightnessPct !== undefined &&
              (!Number.isFinite(brightnessPct) ||
                brightnessPct < 1 ||
                brightnessPct > 100 ||
                entityIds.some((id) => !Object.hasOwn(brightness, id))))
          ) {
            fail("invalid_format");
            break;
          }
          const receivedAt = performance.now();
          const updates = {};
          for (const entityId of entityIds) {
            const state =
              service === "turn_on" || (service === "toggle" && states[entityId] === "off")
                ? "on"
                : "off";
            states[entityId] = state;
            if (brightnessPct !== undefined)
              brightness[entityId] = Math.round((brightnessPct / 100) * 255);
            updates[entityId] = {
              "+": {
                s: state,
                c: "benchmark",
                ...(brightnessPct !== undefined ? { a: { brightness: brightness[entityId] } } : {}),
              },
            };
          }
          result({ context: { id: "benchmark" } });
          for (const subscription of this.#entities) entityEvent(subscription, { c: updates });
          calls.push({
            service,
            entityIds,
            ...(brightnessPct !== undefined ? { brightnessPct } : {}),
            receivedAt,
            updatedAt: performance.now(),
          });
          break;
        }
        case "ping":
          this.#deliver({ id, type: "pong" });
          break;
        default:
          fail("unknown_command");
      }
    }

    close() {
      this.readyState = nativeSocket.CLOSED;
      this.#entities.clear();
      queueMicrotask(() => this.dispatchEvent(new Event("close")));
    }
  }

  window.WebSocket = new Proxy(nativeSocket, {
    construct(target, args) {
      return String(args[0]) === fixtureSocketUrl
        ? new FixtureSocket()
        : Reflect.construct(target, args);
    },
  });
  return {
    origin,
    accessToken,
    snapshot: () => structuredClone({ states, brightness, calls }),
  };
}
