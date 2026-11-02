import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  lightBrightnessCall,
  lightBrightnessRatio,
  supportsLightBrightness,
  type SupportedServiceCall,
} from "../home-assistant-controls";

import type { ResolvedEntityBinding } from "../types";

import { useOptimisticCommand } from "./control-primitives";

import { confirmationKey, toggleCallForPressed } from "./entity-field-contract";

export function PhysicalToggle(props: {
  binding: ResolvedEntityBinding;
  enabled: boolean;
  tone: "light" | "switch";
  onCallService: (call: SupportedServiceCall) => Promise<unknown>;
}) {
  const entity = props.binding.state;
  if (!entity) return null;
  return <PhysicalToggleWithEntity {...props} binding={{ ...props.binding, state: entity }} />;
}

function PhysicalToggleWithEntity({
  binding,
  enabled,
  tone,
  onCallService,
}: {
  binding: ResolvedEntityBinding & { state: NonNullable<ResolvedEntityBinding["state"]> };
  enabled: boolean;
  tone: "light" | "switch";
  onCallService: (call: SupportedServiceCall) => Promise<unknown>;
}) {
  const entity = binding.state;
  const command = useOptimisticCommand({
    confirmedKey: confirmationKey(entity),
    confirmedValue: entity.state === "on",
    label: binding.label,
    onCallService,
  });
  const action = command.value ? "off" : "on";
  return (
    <div
      className="physical-toggle"
      data-active={command.value ? "true" : "false"}
      data-tone={tone}
    >
      <button
        type="button"
        aria-label={`Turn ${action} ${binding.label}`}
        aria-pressed={command.value}
        data-pending={command.pending ? "true" : "false"}
        disabled={!enabled || command.pending}
        onClick={() => {
          const nextPressed = !command.value;
          void command.run(toggleCallForPressed(entity, nextPressed), nextPressed);
        }}
      >
        <span className="physical-toggle__paddle" aria-hidden="true">
          <span className="physical-toggle__glyph">{tone === "light" ? "☀" : "●"}</span>
        </span>
        <span className="visually-hidden">Turn {action}</span>
      </button>
      {command.error && (
        <p role="alert" aria-live="assertive">
          {command.error}
        </p>
      )}
    </div>
  );
}

function LightDimmer(props: {
  binding: ResolvedEntityBinding;
  enabled: boolean;
  onCallService: (call: SupportedServiceCall) => Promise<unknown>;
}) {
  const entity = props.binding.state;
  if (!entity) return null;
  return <LightDimmerWithEntity {...props} binding={{ ...props.binding, state: entity }} />;
}

/**
 * The dimmer's reading: 0 for a light that is off, unavailable or stale (Home Assistant reports no brightness for an off light, so
 * the attribute cannot be used), and 1 to 100 for a lit one, which never reads 0.
 */
export const lightDimmerPercent = (entity: Parameters<typeof lightBrightnessRatio>[0]) => {
  const ratio = lightBrightnessRatio(entity);
  return ratio === 0 ? 0 : Math.min(100, Math.max(1, Math.round(ratio * 100)));
};

function LightDimmerWithEntity({
  binding,
  enabled,
  onCallService,
}: {
  binding: ResolvedEntityBinding & { state: NonNullable<ResolvedEntityBinding["state"]> };
  enabled: boolean;
  onCallService: (call: SupportedServiceCall) => Promise<unknown>;
}) {
  const entity = binding.state;
  const brightness = lightDimmerPercent(entity);
  const brightnessConfirmationKey = confirmationKey(entity, brightness);
  const requestedLevel = useRef({ confirmed: brightness, requested: brightness });
  useLayoutEffect(() => {
    requestedLevel.current = { confirmed: brightness, requested: brightness };
  }, [brightnessConfirmationKey, brightness]);
  const level = useOptimisticCommand({
    confirmedKey: brightnessConfirmationKey,
    confirmedValue: brightness,
    label: `${binding.label} brightness`,
    onCallService,
  });
  const power = useOptimisticCommand({
    confirmedKey: confirmationKey(entity),
    confirmedValue: entity.state === "on",
    label: binding.label,
    onCallService,
  });
  const action = power.value ? "off" : "on";
  const style = { "--light-level": `${Math.min(100, Math.max(0, level.value))}%` } as CSSProperties;
  const updateLevel = (requestedValue: number) => {
    const boundedValue = Math.min(100, Math.max(1, Math.round(requestedValue)));
    if (!Number.isFinite(boundedValue) || requestedLevel.current.requested === boundedValue) return;
    requestedLevel.current.requested = boundedValue;
    void level.run(lightBrightnessCall(entity, boundedValue), boundedValue).then((succeeded) => {
      if (!succeeded && requestedLevel.current.requested === boundedValue) {
        requestedLevel.current.requested = requestedLevel.current.confirmed;
      }
    });
  };
  const updateLevelFromPosition = (input: HTMLInputElement, clientY: number) => {
    const bounds = input.getBoundingClientRect();
    const position = Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height));
    updateLevel(100 - position * 99);
  };
  const updateLevelFromPointer = (event: ReactPointerEvent<HTMLInputElement>) => {
    updateLevelFromPosition(event.currentTarget, event.clientY);
  };
  return (
    <div className="light-dimmer" data-active={power.value ? "true" : "false"} style={style}>
      <div className="light-dimmer__reading">
        <output aria-label={`${binding.label} brightness value`}>{Math.round(level.value)}%</output>
      </div>
      <div className="light-dimmer__well">
        <span className="light-dimmer__fill" aria-hidden="true" />
        <span className="light-dimmer__thumb" aria-hidden="true" />
        <input
          type="range"
          aria-label={`${binding.label} brightness`}
          min={0}
          max={100}
          value={level.value}
          readOnly
          disabled={!enabled}
          data-pending={level.pending ? "true" : "false"}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            updateLevelFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateLevelFromPointer(event);
            }
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateLevelFromPointer(event);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onInput={(event) => {
            updateLevel(Number(event.currentTarget.value));
          }}
          onChange={(event) => {
            updateLevel(Number(event.currentTarget.value));
          }}
          onKeyDown={(event) => {
            const requestedValue = (() => {
              switch (event.key) {
                case "ArrowUp":
                case "ArrowRight":
                  return level.value + 1;
                case "ArrowDown":
                case "ArrowLeft":
                  return level.value - 1;
                case "PageUp":
                  return level.value + 10;
                case "PageDown":
                  return level.value - 10;
                case "Home":
                  return 1;
                case "End":
                  return 100;
                default:
                  return null;
              }
            })();
            if (requestedValue !== null) {
              event.preventDefault();
              updateLevel(requestedValue);
            }
          }}
        />
      </div>
      <button
        className="light-dimmer__power"
        type="button"
        aria-label={`Turn ${action} ${binding.label}`}
        aria-pressed={power.value}
        data-pending={power.pending ? "true" : "false"}
        disabled={!enabled || power.pending}
        onClick={() => {
          const nextPressed = !power.value;
          void power.run(toggleCallForPressed(entity, nextPressed), nextPressed);
        }}
      >
        <span className="visually-hidden">Turn {action}</span>
      </button>
      {(level.error || power.error) && (
        <p role="alert" aria-live="assertive">
          {level.error ?? power.error}
        </p>
      )}
    </div>
  );
}

export function LightFields({
  binding,
  enabled,
  onCallService,
}: {
  binding: ResolvedEntityBinding;
  enabled: boolean;
  onCallService: (call: SupportedServiceCall) => Promise<unknown>;
}) {
  const entity = binding.state;
  if (!entity) return null;
  return supportsLightBrightness(entity) ? (
    <LightDimmer binding={binding} enabled={enabled} onCallService={onCallService} />
  ) : (
    <PhysicalToggle
      binding={binding}
      enabled={enabled}
      tone="light"
      onCallService={onCallService}
    />
  );
}
