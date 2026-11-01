import { useMeasurementUnits } from "./measurement-units";
import { formatMeasurementText } from "./measurement-text";

/** React display boundary for metric diagnostic messages. */
export function MeasurementText({ children }: { children: string }) {
  return formatMeasurementText(children, useMeasurementUnits());
}
