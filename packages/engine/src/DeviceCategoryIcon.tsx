import {
  IconActivityHeartbeat,
  IconAdjustmentsHorizontal,
  IconBellRinging,
  IconBulb,
  IconCamera,
  IconDeviceSpeaker,
  IconDroplet,
  IconFlame,
  IconGauge,
  IconHelpCircle,
  IconLock,
  IconNumber123,
  IconPointer,
  IconPower,
  IconPropeller,
  IconShield,
  IconTemperature,
  IconToggleLeft,
  IconVacuumCleaner,
  IconArrowsLeftRight,
  IconWindow,
} from "@tabler/icons-react";

const DEVICE_CATEGORY_ICONS: Record<string, typeof IconHelpCircle> = {
  alarm_control_panel: IconShield,
  binary_sensor: IconActivityHeartbeat,
  button: IconPointer,
  event: IconPointer,
  camera: IconCamera,
  climate: IconTemperature,
  cover: IconWindow,
  fan: IconPropeller,
  humidifier: IconDroplet,
  input_boolean: IconToggleLeft,
  light: IconBulb,
  lock: IconLock,
  media_player: IconDeviceSpeaker,
  number: IconNumber123,
  select: IconAdjustmentsHorizontal,
  sensor: IconGauge,
  siren: IconBellRinging,
  switch: IconPower,
  vacuum: IconVacuumCleaner,
  valve: IconArrowsLeftRight,
  water_heater: IconFlame,
};

export function DeviceCategoryIcon({
  domain,
  className,
  size = 19,
}: {
  domain: string;
  className?: string;
  size?: number;
}) {
  const Icon = DEVICE_CATEGORY_ICONS[domain] ?? IconHelpCircle;
  return <Icon className={className} size={size} stroke={1.75} />;
}
