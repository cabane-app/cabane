import { DeviceCategoryIcon } from "../DeviceCategoryIcon";

import { entityDisplayValue, type SupportedServiceCall } from "../home-assistant-controls";

import { bindingCanMutate } from "../home-assistant-resolver";

import type { EntityStateSnapshot } from "../types";

import { ButtonFields, NumberFields, SelectFields, VacuumFields } from "./appliance-domain-fields";

import { HumidifierFields, WaterHeaterFields } from "./climate-domain-fields";

import { AlarmFields, LockFields, SirenFields, ValveFields } from "./security-domain-fields";

import { ClimateDialFields } from "./climate-dial-fields";
import { CoverFields } from "./cover-fields";
import { EntityFieldsProps, isVersatileThermostat } from "./entity-field-contract";
import { FanFields } from "./fan-fields";
import { LightFields, PhysicalToggle } from "./light-fields";
import { MediaFields } from "./media-fields";
import { safeIssueMessage, type RoomModuleViewModel } from "./module-model";

export interface RoomModuleProps {
  module: RoomModuleViewModel;
  canMutate: boolean;
  focused: boolean;
  onCallService: (call: SupportedServiceCall) => Promise<unknown>;
  onOpenLiveFeed?: (() => void) | undefined;
}

const readableSensorValue = (entity: EntityStateSnapshot) => {
  if (!entity.entityId.startsWith("binary_sensor.")) return entityDisplayValue(entity);
  const active = entity.state === "on";
  switch (entity.attributes.device_class) {
    case "door":
    case "opening":
    case "window":
      return active ? "Open" : "Closed";
    case "motion":
      return active ? "Motion detected" : "Clear";
    case "moisture":
      return active ? "Wet" : "Dry";
    default:
      return active ? "On" : "Off";
  }
};

const moduleGridSize = (moduleKind: string) => {
  switch (moduleKind) {
    case "vtherm":
    case "climate":
    case "humidifier":
    case "water_heater":
      return "2x2";
    case "light":
    case "switch":
    case "input_boolean":
    case "fan":
    case "lock":
    case "siren":
    case "button":
      return "2x1";
    case "media_player":
    case "cover":
    case "camera":
    case "vacuum":
    case "alarm_control_panel":
    case "valve":
    case "select":
    case "number":
      return "1x2";
    default:
      return "1x1";
  }
};

function EntityFields({ binding, canMutate, focused, onCallService }: EntityFieldsProps) {
  const entity = binding.state;
  if (!entity) return null;
  const enabled = canMutate && bindingCanMutate(binding);
  switch (binding.domain) {
    case "light":
      return <LightFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    case "switch":
    case "input_boolean":
      return (
        <PhysicalToggle
          binding={binding}
          enabled={enabled}
          tone="switch"
          onCallService={onCallService}
        />
      );
    case "event":
    case "sensor":
    case "binary_sensor":
      return <output className="room-module__reading">{readableSensorValue(entity)}</output>;
    case "climate":
      return (
        <ClimateDialFields binding={binding} enabled={enabled} onCallService={onCallService} />
      );
    case "cover":
      return <CoverFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    case "fan":
      return (
        <FanFields
          binding={binding}
          enabled={enabled}
          focused={focused}
          onCallService={onCallService}
        />
      );
    case "media_player":
      return <MediaFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    case "humidifier":
      return <HumidifierFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    case "water_heater":
      return (
        <WaterHeaterFields binding={binding} enabled={enabled} onCallService={onCallService} />
      );
    case "vacuum":
      return <VacuumFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    case "lock":
      return <LockFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    case "alarm_control_panel":
      return <AlarmFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    case "valve":
      return <ValveFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    case "siren":
      return <SirenFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    case "select":
      return <SelectFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    case "number":
      return <NumberFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    case "button":
      return <ButtonFields binding={binding} enabled={enabled} onCallService={onCallService} />;
    default:
      return null;
  }
}

export function RoomModule({
  module,
  canMutate,
  focused,
  onCallService,
  onOpenLiveFeed,
}: RoomModuleProps) {
  const primaryDomain = module.entities[0]?.domain ?? "unknown";
  const displayDomain = onOpenLiveFeed ? "camera" : primaryDomain;
  const showEntityLabels = module.entities.length > 1;
  const moduleKind = onOpenLiveFeed
    ? "camera"
    : module.entities.some(isVersatileThermostat)
      ? "vtherm"
      : primaryDomain;
  return (
    <article
      className={`room-module${focused ? " is-focused" : ""}`}
      data-grid-size={moduleGridSize(moduleKind)}
      data-module-kind={moduleKind}
    >
      <header className="room-module__header">
        <span className={`room-module__icon is-${displayDomain}`} aria-hidden="true">
          <DeviceCategoryIcon domain={displayDomain} className="room-module__glyph" />
        </span>
        <h2>{module.label}</h2>
      </header>
      <div className="room-module__body">
        {module.entities.map((binding) => (
          <section className="room-module__entity" key={binding.slotId}>
            {showEntityLabels && <h3>{binding.label}</h3>}
            <EntityFields
              binding={binding}
              canMutate={canMutate}
              focused={focused}
              onCallService={onCallService}
            />
          </section>
        ))}
        {onOpenLiveFeed && (
          <div className="room-module__camera-action">
            <span aria-live="polite">
              {module.entities[0]?.state?.available && !module.entities[0]?.state?.stale
                ? "Ready for live view"
                : "Camera connection required"}
            </span>
            <button type="button" className="is-primary" onClick={onOpenLiveFeed}>
              {module.entities.length > 0 ? "Open live feed" : "Review connection"}
            </button>
          </div>
        )}
        {module.issues.length > 0 && (
          <div className="room-module__issues" role="status">
            {module.issues.map((issue) => (
              <p key={`${issue.code}:${issue.path}`}>{safeIssueMessage(module.label, issue)}</p>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
