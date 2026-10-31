import { useSyncExternalStore } from "react";

export type MeasurementUnits = "metric" | "imperial";
const KEY = "cabane.measurement-units.v1";
const listeners = new Set<() => void>();
let session: MeasurementUnits | undefined;
function snapshot(): MeasurementUnits {
  return readMeasurementUnits();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const storage = () => {
    session = undefined;
    listener();
  };
  const target = typeof window === "undefined" ? undefined : window;
  target?.addEventListener("storage", storage);
  return () => {
    listeners.delete(listener);
    target?.removeEventListener("storage", storage);
  };
}
export function setMeasurementUnits(units: MeasurementUnits) {
  session = units;
  try {
    window.localStorage.setItem(KEY, units);
  } catch {
    /* Session preference still works. */
  }
  listeners.forEach((listener) => listener());
}
export function useMeasurementUnits() {
  return useSyncExternalStore(subscribe, snapshot, () => "metric" as const);
}
export function lengthUnit(units: MeasurementUnits) {
  return units === "imperial" ? "ft" : "m";
}
export function displayLength(meters: number, units: MeasurementUnits) {
  return units === "imperial" ? meters / 0.3048 : meters;
}
export function storedLength(value: number, units: MeasurementUnits) {
  return units === "imperial" ? value * 0.3048 : value;
}
export function formatLength(meters: number, units: MeasurementUnits, decimals = 2) {
  return `${displayLength(meters, units).toFixed(decimals)} ${lengthUnit(units)}`;
}
export function formatArea(squareMeters: number, units: MeasurementUnits) {
  return `${(units === "imperial" ? squareMeters / 0.3048 ** 2 : squareMeters).toFixed(1)} ${units === "imperial" ? "ft²" : "m²"}`;
}
/** Plain number plus unit label, for issue messages that show lengths inline. */
export function formatLengthPlain(meters: number, units: MeasurementUnits, decimals = 2) {
  return `${displayLength(meters, units).toFixed(decimals)} ${lengthUnit(units)}`;
}
/**
 * Reads the user's display-unit preference without a browser (Node validation, CLI and
 * test workers default to metric). React components should prefer useMeasurementUnits.
 */
export function readMeasurementUnits(): MeasurementUnits {
  if (session) return session;
  try {
    return window.localStorage.getItem(KEY) === "imperial" ? "imperial" : "metric";
  } catch {
    return "metric";
  }
}
/** Bare numbers use the selected unit; explicit metric and feet/inches input is also accepted. */
export function parseLength(text: string, units: MeasurementUnits): number {
  const normalized = text
    .trim()
    .toLowerCase()
    .replaceAll(",", ".")
    .replaceAll("′", "'")
    .replaceAll("″", '"');
  const number = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)";
  const metric = normalized.match(new RegExp(`^(${number})\\s*(mm|cm|m)$`));
  if (metric) return Number(metric[1]) * { mm: 0.001, cm: 0.01, m: 1 }[metric[2]]!;
  const feet = normalized.match(
    new RegExp(`^(${number})\\s*(?:ft|')\\s*(?:(\\d+(?:\\.\\d*)?)\\s*(?:in|"))?$`),
  );
  if (feet)
    return (
      Number(feet[1]) * 0.3048 + (feet[1].startsWith("-") ? -1 : 1) * Number(feet[2] ?? 0) * 0.0254
    );
  const inches = normalized.match(new RegExp(`^(${number})\\s*(?:in|")$`));
  if (inches) return Number(inches[1]) * 0.0254;
  return new RegExp(`^${number}$`).test(normalized) ? storedLength(Number(normalized), units) : NaN;
}
