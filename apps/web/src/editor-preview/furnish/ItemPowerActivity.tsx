import {
  isPowerActivitySlot,
  isPowerReading,
  powerReadingWatts,
  type DeviceItemSpec,
  type PowerActivitySettings,
} from "@cabane/engine";
import type { ItemConnectionContext } from "./ItemEntitySlots";
import { NumericField } from "./NumericField";
import "./item-power-activity.css";

export function ItemPowerActivity({
  item,
  connections,
  onChange,
}: {
  item: DeviceItemSpec;
  connections?: ItemConnectionContext | undefined;
  onChange: (settings: PowerActivitySettings | null) => void;
}) {
  const settings = item.powerActivity;
  const stateFor = (slotId: string) => {
    const entityId = connections?.profile.entityIdsBySlotId[slotId];
    return entityId ? connections?.runtime.entityStates[entityId] : undefined;
  };
  const readings = item.entitySlots.filter(
    (slot) =>
      isPowerActivitySlot(slot) &&
      (isPowerReading(stateFor(slot.id)) || slot.id === settings?.slotId),
  );
  const primarySlot = item.entitySlots.find((slot) => slot.deviceRole === "primary");
  const primaryId = primarySlot && connections?.profile.entityIdsBySlotId[primarySlot.id];
  const nativeState = primaryId && !primaryId.startsWith("switch.");
  const reading = settings && stateFor(settings.slotId);
  const unavailable = settings && powerReadingWatts(reading) === null;
  return (
    <fieldset>
      <legend>Activity</legend>
      <label className="item-power-activity-source">
        <span>Animation source</span>
        <select
          value={settings?.slotId ?? ""}
          disabled={Boolean(nativeState) && !settings}
          onChange={(event) =>
            onChange(
              event.currentTarget.value
                ? {
                    slotId: event.currentTarget.value,
                    thresholdWatts: settings?.thresholdWatts ?? 5,
                  }
                : null,
            )
          }
        >
          <option value="">Connected state</option>
          {readings.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.presentation.label}
            </option>
          ))}
        </select>
      </label>
      {settings && (
        <NumericField
          label="Power threshold"
          unit="W"
          min={0}
          step={1}
          value={settings.thresholdWatts}
          onChange={(thresholdWatts) => onChange({ ...settings, thresholdWatts })}
        />
      )}
      <p className="editor-properties-note">
        {nativeState
          ? "Power activity applies when connected to a switch."
          : unavailable
            ? "Power reading unavailable. Animation stays idle."
            : settings
              ? "Animation runs only above the threshold. Unavailable power keeps it idle."
              : "Use Add reading to attach a power sensor (W or kW)."}
      </p>
    </fieldset>
  );
}
