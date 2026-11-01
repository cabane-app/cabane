import type { MeasurementUnits } from "./measurement-units";

const number = "[−+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?";
const quantity = new RegExp(
  `(?<![\\w.])(${number})(?:(\\s*(?:[–—]|-|and|to)\\s*)(${number}))?\\s*(mm|cm|m²|m2|metres?|meters?|m)(?![\\w²])`,
  "gi",
);
const decimal = new Intl.NumberFormat("en", {
  maximumSignificantDigits: 6,
  useGrouping: false,
});

/** Format human-readable diagnostics at display time, leaving validation and IDs intact. */
export function formatMeasurementText(text: string, units: MeasurementUnits): string {
  if (units === "metric") return text;
  // Quoted object names and technical paths are identifiers, not measurements.
  return text
    .split(/("[^"\n]*"|`[^`\n]*`)/g)
    .map((part, index) => {
      if (index % 2) return part;
      return part
        .replace(
          quantity,
          (
            _match,
            first: string,
            separator: string | undefined,
            last: string | undefined,
            unit: string,
          ) => {
            unit = unit.toLowerCase();
            const area = unit === "m²" || unit === "m2";
            const scale = unit === "mm" ? 0.001 : unit === "cm" ? 0.01 : 1;
            const convert = (value: string) =>
              decimal.format(
                (Number(value.replace("−", "-")) * scale) / (area ? 0.3048 ** 2 : 0.3048),
              );
            return `${convert(first)}${last === undefined ? "" : `${separator}${convert(last)}`} ${area ? "ft²" : "ft"}`;
          },
        )
        .replace(/\bmetres?\b|\bmeters?\b/gi, "feet");
    })
    .join("");
}
