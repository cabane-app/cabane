import { roomDisconnectedIconPath } from "../RoomDisconnectedIcon";
import type { ReactNode } from "react";
import { PresenceStatusIcon } from "../home-presence/PresenceStatusIcon";
import type { RoomStatusSummary } from "./model";

type StatusKind =
  | "disconnected"
  | "temperature"
  | "humidity"
  | "aqi"
  | "heating"
  | "cooling"
  | "light"
  | "presence"
  | "absence"
  | "door";

interface StatusItem {
  readonly kind: StatusKind;
  readonly label: string;
  readonly visibleText?: string;
  readonly state?: string;
}

const readingText = (value: string, unit: string | null) => (unit ? `${value} ${unit}` : value);

const statusItems = (summary: RoomStatusSummary, includeHumidity = true): readonly StatusItem[] => {
  const items: StatusItem[] = [];
  if (summary.temperature) {
    items.push({
      kind: "temperature",
      label: `Temperature ${readingText(summary.temperature.value, summary.temperature.unit)}`,
      visibleText: readingText(summary.temperature.value, summary.temperature.unit),
    });
  }
  if (includeHumidity && summary.humidity) {
    items.push({
      kind: "humidity",
      label: `Humidity ${readingText(summary.humidity.value, summary.humidity.unit)}`,
      visibleText: readingText(summary.humidity.value, summary.humidity.unit),
    });
  }
  if (summary.aqi) {
    const reading = readingText(summary.aqi.value, summary.aqi.unit);
    items.push({
      kind: "aqi",
      label: `Air quality index ${reading}`,
      visibleText: `AQI ${reading}`,
    });
  }
  if (summary.heating) items.push({ kind: "heating", label: "Heating" });
  if (summary.cooling) items.push({ kind: "cooling", label: "Cooling" });
  if (summary.lighting) {
    items.push({
      kind: "light",
      label: summary.lighting === "on" ? "Lights on" : "Lights off",
      state: summary.lighting,
    });
  }
  if (summary.presence) {
    items.push({
      kind: summary.presence === "present" ? "presence" : "absence",
      label: summary.presence === "present" ? "Presence" : "No presence",
      state: summary.presence,
    });
  }
  if (summary.doorOpen) items.push({ kind: "door", label: "Door open" });
  return items;
};

function StatusGlyph({ kind }: { kind: StatusKind }) {
  if (kind === "presence" || kind === "absence") {
    return <PresenceStatusIcon state={kind === "presence" ? "present" : "absent"} />;
  }
  let content: ReactNode = null;
  switch (kind) {
    case "disconnected":
      content = <path d={roomDisconnectedIconPath} />;
      break;
    case "temperature":
      content = (
        <>
          <path d="M10 14.4V5a2 2 0 0 1 4 0v9.4a4 4 0 1 1-4 0Z" />
          <path d="M12 8v8" />
        </>
      );
      break;
    case "humidity":
      content = <path d="M12 3s5 5.6 5 10a5 5 0 0 1-10 0c0-4.4 5-10 5-10Z" />;
      break;
    case "aqi":
      content = (
        <path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 12h16a2 2 0 1 0-2-2M3 16h10a2.5 2.5 0 1 1-2.5 2.5" />
      );
      break;
    case "heating":
      content = (
        <>
          <path d="M7 19c-2-2 2-3 0-6s2-4 1-7" />
          <path d="M12 19c-2-2 2-3 0-6s2-4 1-7" />
          <path d="M17 19c-2-2 2-3 0-6s2-4 1-7" />
        </>
      );
      break;
    case "cooling":
      content = (
        <>
          <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
          <path d="m9.5 5 2.5 2.5L14.5 5M9.5 19l2.5-2.5 2.5 2.5" />
        </>
      );
      break;
    case "light":
      content = (
        <>
          <path d="M9 16h6M10 20h4" />
          <path d="M8 12.5a5 5 0 1 1 8 0c-1 .9-1.5 1.7-1.5 3.5h-5c0-1.8-.5-2.6-1.5-3.5Z" />
        </>
      );
      break;
    case "door":
      content = (
        <>
          <path d="M5 21V3h11v18M16 6l4 2v13h-4" />
          <path d="M13 12h.01" />
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {content}
    </svg>
  );
}

export const roomStatusAccessibleText = (summary: RoomStatusSummary, includeHumidity = true) =>
  statusItems(summary, includeHumidity)
    .map((item) => item.label)
    .join(", ");

export function RoomStatusBadges({
  summary,
  variant,
  className = "",
  includeHumidity = true,
  includeConnection = false,
}: {
  summary: RoomStatusSummary;
  variant: "detailed" | "compact";
  className?: string;
  includeHumidity?: boolean;
  includeConnection?: boolean;
}) {
  const items: readonly StatusItem[] = [
    ...(includeConnection && summary.connected === false
      ? [
          {
            kind: "disconnected" as const,
            label: "Room not connected to Home Assistant",
            visibleText: "Not connected",
          },
        ]
      : []),
    ...statusItems(summary, includeHumidity),
  ];
  if (items.length === 0) return null;
  return (
    <div
      className={`room-status-badges ${className}`.trim()}
      data-variant={variant}
      role="list"
      aria-label="Room status"
    >
      {items.map((item) => {
        const showText = variant === "detailed" || Boolean(item.visibleText);
        return (
          <span
            key={item.kind}
            className="room-status-badge"
            data-kind={item.kind}
            data-state={item.state}
            role="listitem"
            aria-label={item.label}
            title={variant === "compact" ? item.label : undefined}
          >
            <span className="room-status-badge__icon">
              <StatusGlyph kind={item.kind} />
            </span>
            {showText ? (
              <span className="room-status-badge__label">{item.visibleText ?? item.label}</span>
            ) : (
              <span className="visually-hidden">{item.label}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
