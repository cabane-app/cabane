import { textAttribute } from "./entity-field-contract";
import { useLayoutEffect, useRef, useState } from "react";

import {
  climateFanModeCall,
  climateModeCall,
  climatePresetCall,
  climateRangeContext,
  climateSwingModeCall,
  climateTargetTemperature,
  climateTemperatureCall,
  climateTemperatureRange,
  stringOptions,
  type SupportedServiceCall,
} from "../home-assistant-controls";

import type { EntityStateSnapshot, ResolvedEntityBinding } from "../types";

import { ClimateRangeDial, ClimateTemperatureDial } from "./climate-temperature-dial";
import { TemperatureStepper, useOptimisticCommand } from "./control-primitives";

import { confirmationKey, isVersatileThermostat } from "./entity-field-contract";

const readableOption = (option: string) =>
  option.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());

const vthermOptionSymbol = (option: string) =>
  ({
    activity: "◌",
    auto: "A",
    boost: "▲",
    comfort: "▰",
    cool: "❄",
    dry: "◇",
    eco: "◆",
    fan_only: "✣",
    frost: "❄",
    heat: "♨",
    heat_cool: "◐",
    home: "⌂",
    none: "—",
    off: "⏻",
  })[option] ?? "•";

function ClimateOptionPicker({
  binding,
  kind,
  open,
  onOpenChange,
  value,
  options,
  disabled,
  confirmedKey,
  callForValue,
  onCallService,
  modeCommand,
}: {
  binding: ResolvedEntityBinding;
  modeCommand?: ReturnType<typeof useOptimisticCommand<string>>;
  kind: "mode" | "preset" | "fan mode" | "swing mode";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  options: readonly string[];
  disabled: boolean;
  confirmedKey: string;
  callForValue: (value: string) => SupportedServiceCall;
  onCallService: (call: SupportedServiceCall) => Promise<unknown>;
}) {
  const ownCommand = useOptimisticCommand({
    confirmedKey,
    confirmedValue: value,
    label: `${binding.label} ${kind}`,
    onCallService,
  });
  const command = modeCommand ?? ownCommand;
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    menuRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [open]);
  if (options.length === 0) return null;
  const pickerClass = kind.replace(" ", "-");
  const selectedLabel = command.value ? readableOption(command.value) : "None";
  return (
    <div className="vtherm-picker-shell">
      <details
        className={`vtherm-picker vtherm-picker--${pickerClass}`}
        data-disabled={disabled ? "true" : "false"}
        open={open}
      >
        <summary
          aria-label={`Choose ${binding.label} ${kind}`}
          aria-disabled={disabled ? "true" : "false"}
          onClick={(event) => {
            event.preventDefault();
            if (!disabled) onOpenChange(!open);
          }}
        >
          <span
            className="vtherm-picker__symbol"
            data-symbol={
              kind === "mode" ? vthermOptionSymbol(command.value) : kind === "preset" ? "◒" : "•"
            }
            aria-hidden="true"
          />
          <span className="vtherm-picker__copy">
            <small>{readableOption(kind)}</small>
            <strong>{selectedLabel}</strong>
          </span>
        </summary>
        <div
          className="vtherm-picker__menu"
          ref={menuRef}
          role="group"
          aria-label={`${binding.label} ${kind} choices`}
        >
          {options.map((option) => (
            <button
              type="button"
              key={option}
              aria-label={`Set ${binding.label} ${kind} to ${option}`}
              aria-pressed={command.value === option}
              data-option={option}
              data-symbol={vthermOptionSymbol(option)}
              data-pending={command.pending && command.value === option ? "true" : "false"}
              disabled={disabled}
              onClick={() => {
                onOpenChange(false);
                void command.run(callForValue(option), option);
              }}
            >
              <span
                className="vtherm-picker__option-symbol"
                data-symbol={vthermOptionSymbol(option)}
                aria-hidden="true"
              />
              <span>{readableOption(option)}</span>
            </button>
          ))}
        </div>
      </details>
      {command.error && (
        <p role="alert" aria-live="assertive">
          {command.error}
        </p>
      )}
    </div>
  );
}

const vthermStatuses = (entity: EntityStateSnapshot) => {
  const motion = textAttribute(entity.attributes.motion_state ?? "unavailable");
  const windowState = textAttribute(entity.attributes.window_state ?? "unavailable");
  const safety = textAttribute(entity.attributes.safety_state ?? "unavailable");
  const overpowering = textAttribute(entity.attributes.overpowering_state ?? "unavailable");
  const windowBypass =
    entity.attributes.is_window_bypass === true || entity.attributes.window_bypass_state === true;
  return [
    motion === "on" && "Activity detected",
    windowState === "on" && (windowBypass ? "Window bypass active" : "Window open"),
    safety === "on" && "Safety active",
    overpowering === "on" && "Power limit active",
  ].filter((status): status is string => Boolean(status));
};

export function ClimateDialFields(props: {
  binding: ResolvedEntityBinding;
  enabled: boolean;
  onCallService: (call: SupportedServiceCall) => Promise<unknown>;
}) {
  const entity = props.binding.state;
  if (!entity) return null;
  return <ClimateDialFieldsWithEntity {...props} binding={{ ...props.binding, state: entity }} />;
}

function ClimateDialFieldsWithEntity({
  binding,
  enabled,
  onCallService,
}: {
  binding: ResolvedEntityBinding & { state: NonNullable<ResolvedEntityBinding["state"]> };
  enabled: boolean;
  onCallService: (call: SupportedServiceCall) => Promise<unknown>;
}) {
  const [openPicker, setOpenPicker] = useState<
    "mode" | "preset" | "fan mode" | "swing mode" | null
  >(null);
  const entity = binding.state;
  const modeCommand = useOptimisticCommand({
    confirmedKey: confirmationKey(entity, entity.state),
    confirmedValue: entity.state,
    label: `${binding.label} mode`,
    onCallService,
  });
  const range = climateTemperatureRange(entity);
  const target = climateTargetTemperature(entity);
  const targetTemperature = target?.kind === "single" ? target.temperature : null;
  const [dialTargetTemperature, setDialTargetTemperature] = useState(targetTemperature);
  const currentTemperature = Number(entity.attributes.current_temperature);
  const regulatedTemperature = Number(entity.attributes.regulated_target_temperature);
  const temperatureUnit =
    typeof entity.attributes.temperature_unit === "string"
      ? entity.attributes.temperature_unit
      : "°C";
  const hasCurrentTemperature = Number.isFinite(currentTemperature);
  const dialTemperature = dialTargetTemperature ?? targetTemperature;
  const modeOptions = stringOptions(entity.attributes.hvac_modes);
  const hasDirectOff = isVersatileThermostat(binding) && modeOptions.includes("off");
  const preferredOnMode =
    targetTemperature !== null &&
    dialTemperature !== null &&
    hasCurrentTemperature &&
    currentTemperature > dialTemperature
      ? "cool"
      : "heat";
  const onMode =
    [preferredOnMode, "heat", "cool", "heat_cool", "auto"].find((mode) =>
      modeOptions.includes(mode),
    ) ?? modeOptions.find((mode) => mode !== "off");
  const powerMode = modeCommand.value === "off" ? onMode : "off";
  const presetOptions = stringOptions(entity.attributes.preset_modes);
  const fanOptions = stringOptions(entity.attributes.fan_modes);
  const swingOptions = isVersatileThermostat(binding)
    ? []
    : stringOptions(entity.attributes.swing_modes);
  const pickerCount = [modeOptions, presetOptions, fanOptions, swingOptions].filter(
    (options) => options.length > 0,
  ).length;
  const presetMode = textAttribute(entity.attributes.preset_mode ?? "");
  const fanMode = textAttribute(entity.attributes.fan_mode ?? "");
  const swingMode = textAttribute(entity.attributes.swing_mode ?? "");
  const statuses = isVersatileThermostat(binding) ? vthermStatuses(entity) : [];
  const rawAction = textAttribute(
    entity.attributes.hvac_action ?? (entity.state === "off" ? "off" : entity.state),
  );
  const actionLabel =
    modeCommand.value === "off" ? "Off" : (statuses[0] ?? readableOption(rawAction));
  const updateOpenPicker = (kind: "mode" | "preset" | "fan mode" | "swing mode", open: boolean) => {
    setOpenPicker((current) => (open ? kind : current === kind ? null : current));
  };

  return (
    <div className="vtherm-control" data-mode={modeCommand.value} data-direct-off={hasDirectOff}>
      <div className="vtherm-readings">
        {Number.isFinite(currentTemperature) && (
          <span>
            <small>Current temperature</small>
            <output aria-label={`${binding.label} current temperature`}>
              {currentTemperature} {temperatureUnit}
            </output>
          </span>
        )}
        {Number.isFinite(regulatedTemperature) && (
          <span>
            <small>AC target</small>
            <output aria-label={`${binding.label} AC target temperature`}>
              {regulatedTemperature} {temperatureUnit}
            </output>
          </span>
        )}
      </div>

      <div className={`vtherm-main vtherm-main--${target?.kind ?? "status"}`}>
        {targetTemperature !== null && dialTemperature !== null && (
          <ClimateTemperatureDial
            min={range.min}
            max={range.max}
            current={currentTemperature}
            target={dialTemperature}
          />
        )}

        <div className="vtherm-action" aria-live="polite">
          {actionLabel}
        </div>

        {targetTemperature !== null && (
          <div className="vtherm-temperature" data-unit={temperatureUnit}>
            <TemperatureStepper
              label={`${binding.label} target temperature`}
              min={range.min}
              max={range.max}
              step={range.step}
              confirmedValue={targetTemperature}
              confirmedKey={confirmationKey(entity, targetTemperature)}
              disabled={!enabled}
              callForValue={(value) => climateTemperatureCall(entity, value)}
              onCallService={onCallService}
              onValueChange={setDialTargetTemperature}
            />
          </div>
        )}
        {target?.kind === "range" && (
          <ClimateRangeDial
            key={`${entity.entityId}:${climateRangeContext(entity, target)}`}
            entity={entity}
            label={binding.label}
            unit={temperatureUnit}
            current={currentTemperature}
            target={target}
            enabled={enabled && modeCommand.value === entity.state && !modeCommand.pending}
            onCallService={onCallService}
          />
        )}
        {hasDirectOff && (
          <button
            type="button"
            className="vtherm-off"
            aria-label={`Turn ${modeCommand.value === "off" ? "on" : "off"} ${binding.label}`}
            title={modeCommand.value === "off" ? "Turn on" : "Turn off"}
            aria-pressed={modeCommand.value === "off"}
            aria-busy={modeCommand.pending}
            disabled={!enabled || modeCommand.pending || !powerMode}
            onClick={() => {
              setOpenPicker(null);
              if (powerMode) void modeCommand.run(climateModeCall(entity, powerMode), powerMode);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 3v9M6.3 5.8a8 8 0 1 0 11.4 0" />
            </svg>
          </button>
        )}
      </div>

      {pickerCount > 0 && (
        <div className="vtherm-toolbar" data-picker-count={pickerCount}>
          <ClimateOptionPicker
            binding={binding}
            kind="mode"
            modeCommand={modeCommand}
            open={openPicker === "mode"}
            onOpenChange={(open) => updateOpenPicker("mode", open)}
            value={entity.state}
            options={modeOptions}
            disabled={!enabled}
            confirmedKey={confirmationKey(entity, entity.state)}
            callForValue={(value) => climateModeCall(entity, value)}
            onCallService={onCallService}
          />
          <ClimateOptionPicker
            binding={binding}
            kind="preset"
            open={openPicker === "preset"}
            onOpenChange={(open) => updateOpenPicker("preset", open)}
            value={presetMode}
            options={presetOptions}
            disabled={!enabled}
            confirmedKey={confirmationKey(entity, presetMode)}
            callForValue={(value) => climatePresetCall(entity, value)}
            onCallService={onCallService}
          />
          <ClimateOptionPicker
            binding={binding}
            kind="fan mode"
            open={openPicker === "fan mode"}
            onOpenChange={(open) => updateOpenPicker("fan mode", open)}
            value={fanMode}
            options={fanOptions}
            disabled={!enabled}
            confirmedKey={confirmationKey(entity, fanMode)}
            callForValue={(value) => climateFanModeCall(entity, value)}
            onCallService={onCallService}
          />
          <ClimateOptionPicker
            binding={binding}
            kind="swing mode"
            open={openPicker === "swing mode"}
            onOpenChange={(open) => updateOpenPicker("swing mode", open)}
            value={swingMode}
            options={swingOptions}
            disabled={!enabled}
            confirmedKey={confirmationKey(entity, swingMode)}
            callForValue={(value) => climateSwingModeCall(entity, value)}
            onCallService={onCallService}
          />
        </div>
      )}
    </div>
  );
}
