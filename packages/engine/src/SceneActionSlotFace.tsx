import { useState, type ReactNode } from "react";
import weatherIcon from "./assets/scene-actions/weather.svg";
import buildIcon from "./assets/scene-actions/build.svg";
import viewIcon from "./assets/scene-actions/view.svg";
import walkIcon from "./assets/scene-actions/walk-mode.svg";
import nightIcon from "./assets/scene-actions/day-night.svg";
import lightsIcon from "./assets/scene-actions/all-lights.svg";
import type { ActionBarBuiltIn } from "./action-bar/action-bar-config";

const illustrations: Partial<Record<ActionBarBuiltIn, string>> = {
  weather: weatherIcon,
  build: buildIcon,
  walk: walkIcon,
  night: nightIcon,
  view: viewIcon,
  "all-lights": lightsIcon,
};

export const actionBarBuiltInLabels: Record<ActionBarBuiltIn, string> = {
  weather: "Weather",
  build: "Build",
  walk: "Walk",
  night: "Night",
  view: "View",
  "all-lights": "Lights off",
};

export function ActionBarBuiltInIcon({ action }: { action: ActionBarBuiltIn }) {
  return <img src={illustrations[action]} alt="" draggable={false} />;
}

export function SceneActionSlotFace({
  icon,
  label,
  shortcut,
  chevron,
}: {
  icon: ReactNode;
  label: string;
  shortcut?: string | undefined;
  chevron?: boolean;
}) {
  return (
    <>
      <span className="scene-action-slot__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="scene-action-slot__label" aria-hidden="true">
        {label}
        {chevron && (
          <span className="scene-action-group__chevron" aria-hidden="true">
            ⌃
          </span>
        )}
      </span>
      {shortcut && (
        <kbd className="scene-action-slot__shortcut" aria-hidden="true">
          {shortcut}
        </kbd>
      )}
    </>
  );
}

export function RoomShortcutIcon({
  name,
  pictureUrl,
}: {
  name: string;
  pictureUrl?: (string | null) | undefined;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "R";
  return pictureUrl && failedUrl !== pictureUrl ? (
    <span className="scene-action-room-photo">
      <img src={pictureUrl} alt="" onError={() => setFailedUrl(pictureUrl)} />
    </span>
  ) : (
    <span className="scene-action-room-initials">{initials}</span>
  );
}
