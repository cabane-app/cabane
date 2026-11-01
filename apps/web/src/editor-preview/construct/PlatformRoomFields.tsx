import type { OutdoorPlatformSpec } from "@cabane/engine";
import { RoomMembershipFields } from "./RoomMembershipFields";

export function PlatformRoomFields({
  platform,
  onChange,
}: {
  platform: OutdoorPlatformSpec;
  onChange: (changes: Partial<Omit<OutdoorPlatformSpec, "id">>) => void;
}) {
  return (
    <RoomMembershipFields
      enabled={platform.useAsRoom ?? false}
      name={platform.roomName ?? ""}
      placeholder="e.g. Balcony"
      description="Adds room navigation and Home Assistant area mapping. The platform stays open to the sky."
      onEnabledChange={(useAsRoom) =>
        onChange({
          useAsRoom,
          ...(useAsRoom ? { roomName: platform.roomName?.trim() || "Outdoor room" } : {}),
        })
      }
      onNameCommit={(roomName) => onChange({ roomName })}
    />
  );
}
