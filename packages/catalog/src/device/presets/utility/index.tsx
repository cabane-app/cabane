import type { HomeDeviceModelProps } from "@cabane/engine";
import {
  ElectricalPanel,
  ExternalAcUnit,
  FrenchWallMailbox,
  KitchenHood,
  UsMailbox,
} from "../../../furnishing/presets/utility";

export function FrenchWallMailboxModel() {
  return <FrenchWallMailbox />;
}

export function UsMailboxModel() {
  return <UsMailbox />;
}

export function ElectricalPanelModel() {
  return <ElectricalPanel />;
}

export function KitchenHoodModel({ variant }: HomeDeviceModelProps) {
  return <KitchenHood variant={variant ?? "chimney-canopy"} />;
}

export function ExternalAcUnitModel() {
  return <ExternalAcUnit />;
}
