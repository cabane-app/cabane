import { bindingEntityCandidates } from "../binding-entity-candidates";
import type { BindingEntityCandidateScope } from "../binding-profile-contract";
import type {
  BindingSlotDescriptor,
  HomeAssistantRuntimeSnapshot,
  RuntimeBindingProfile,
} from "../types";
import { entityDeviceNames } from "./auxiliary-mapping-choices";

export const newReadingDescriptor: BindingSlotDescriptor = {
  slotId: "new-reading",
  kind: "dashboard",
  roomIds: [],
  spec: {
    id: "new-reading",
    compatibleDomains: ["sensor", "binary_sensor", "event"],
    deviceRole: "secondary",
    required: false,
    autoMap: "manual",
    presentation: { label: "Reading", dashboardRole: "secondary" },
  },
};

const typeLabels: Record<string, string> = {
  sensor: "Other sensors",
  light: "Lights",
  switch: "Switches",
  valve: "Valves",
  binary_sensor: "Binary sensors",
  event: "Events",
  temperature: "Temperature",
  water: "Water",
  volume: "Water",
  humidity: "Humidity",
  moisture: "Moisture",
  power: "Power",
  energy: "Energy",
  battery: "Battery",
};

export function connectionCandidates(
  descriptor: BindingSlotDescriptor,
  roomId: string,
  profile: RuntimeBindingProfile,
  runtime: HomeAssistantRuntimeSnapshot,
  preferredDeviceId?: string | null,
  scope: BindingEntityCandidateScope = "all-areas",
) {
  const names = entityDeviceNames(runtime);
  const entries = new Map(runtime.entityRegistry.map((entry) => [entry.entity_id, entry]));
  const currentClass =
    runtime.entityStates[profile.entityIdsBySlotId[descriptor.slotId]]?.attributes.device_class;
  const preferredClass = descriptor.spec.compatibleDeviceClasses?.[0] ?? currentClass;
  return bindingEntityCandidates({ descriptor, roomId, profile, runtime, scope })
    .map((candidate) => {
      const domain = candidate.entityId.split(".")[0];
      const deviceClass = runtime.entityStates[candidate.entityId]?.attributes.device_class;
      const type =
        typeof deviceClass === "string" && typeLabels[deviceClass]
          ? typeLabels[deviceClass]
          : (typeLabels[domain] ?? domain.replaceAll("_", " "));
      const deviceName = names.get(candidate.entityId) ?? "";
      const entry = entries.get(candidate.entityId);
      const sameDevice = Boolean(preferredDeviceId && entry?.device_id === preferredDeviceId);
      const suggested =
        !candidate.disabled &&
        !candidate.hidden &&
        candidate.available &&
        candidate.matchRank === 0 &&
        (sameDevice ||
          Boolean(profile.roomAreaIds[roomId] && candidate.areaId === profile.roomAreaIds[roomId]));
      return {
        ...candidate,
        domain,
        type,
        deviceName,
        suggested,
        sameDevice,
        sameClass: Boolean(preferredClass && deviceClass === preferredClass),
        searchText: [candidate.label, candidate.entityId, deviceName, candidate.areaLabel]
          .join(" ")
          .toLocaleLowerCase(),
      };
    })
    .sort(
      (a, b) =>
        Number(b.sameDevice) - Number(a.sameDevice) ||
        Number(b.sameClass) - Number(a.sameClass) ||
        Number(b.suggested) - Number(a.suggested) ||
        a.matchRank - b.matchRank ||
        a.label.localeCompare(b.label),
    );
}
