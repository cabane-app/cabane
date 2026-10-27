import type { DeviceDomain, DeviceModelBounds, DeviceModelComplexity } from "../types";
import { sha256Hex } from "../sha256-digest";

export const CUSTOM_MODEL_LIMITS = {
  fileBytes: 10 * 1024 * 1024,
  homeBytes: 100 * 1024 * 1024,
  triangles: 100_000,
  meshes: 128,
  chunkBytes: 256 * 1024,
} as const;

export const CUSTOM_MODEL_PROFILES = [
  ["furniture", "Furniture"],
  ["light", "Light"],
  ["sensor", "Sensor"],
  ["binary_sensor", "Binary sensor"],
  ["event", "Event (remote / button)"],
  ["camera", "Camera"],
  ["cover", "Cover"],
  ["switch", "Switch"],
  ["input_boolean", "Toggle"],
  ["climate", "Climate"],
  ["fan", "Fan"],
  ["media_player", "Media player"],
  ["humidifier", "Humidifier"],
  ["water_heater", "Water heater"],
  ["vacuum", "Vacuum"],
  ["lock", "Lock"],
  ["alarm_control_panel", "Alarm"],
  ["valve", "Valve"],
  ["siren", "Siren"],
  ["select", "Select"],
  ["number", "Number"],
  ["button", "Button"],
] as const satisfies readonly (readonly ["furniture" | DeviceDomain, string])[];

export type CustomModelProfile = (typeof CUSTOM_MODEL_PROFILES)[number][0];
export type CustomModelPlacement = "floor" | "wall" | "ceiling";
export type ModelVector = readonly [number, number, number];
export interface ModelAssetReference {
  sha256: string;
  byteLength: number;
}
export interface ModelAsset extends ModelAssetReference {
  bytes: Uint8Array;
}
export interface CustomModelNormalization {
  /** Euler XYZ radians, then uniform scale, then translation, in metres. */
  rotation: ModelVector;
  scale: number;
  offset: ModelVector;
  size: ModelVector;
  bounds: DeviceModelBounds;
}
export interface CustomModel {
  id: `custom:${string}`;
  name: string;
  placement: CustomModelPlacement;
  profile: CustomModelProfile;
  asset: ModelAssetReference;
  normalization: CustomModelNormalization;
  complexity: DeviceModelComplexity;
  light?: { position: ModelVector; color: string; maxIntensity: number; distance: number };
}

export interface ModelAssetSource {
  read(sha256: string): Promise<Uint8Array | null>;
}

export const modelAssetReferences = (
  projects: readonly { customModels?: readonly CustomModel[] }[],
) => {
  const references = new Map<string, ModelAssetReference>();
  for (const project of projects)
    for (const model of project.customModels ?? []) references.set(model.asset.sha256, model.asset);
  return [...references.values()];
};

export const modelAssetHash = sha256Hex;
