import { createContext, useContext } from "react";
import { FloorFinishSurfaces } from "../floor-finishes/FloorFinishSurfaces";
import { HomeAssistantSceneLighting } from "../HomeAssistantSceneLighting";
import type { FloorSpec } from "../types";
import type { FloorSceneProps } from "./FloorScene";

// Selection changes only these surfaces. Keep the procedural floor subtree
// independent of this context so opening controls cannot rerender every model.
export const SceneRoomSelection = createContext<string | null>(null);

type RoomSelectionSurfacesProps = Pick<
  FloorSceneProps,
  | "sourceFloor"
  | "manifest"
  | "resolvedBindings"
  | "deviceModels"
  | "reducedMotion"
  | "walkMode"
  | "onSelectRoom"
  | "sceneLightingEnabled"
> & { floor: FloorSpec; outsideRoomId: string };

export function RoomSelectionSurfaces({
  sourceFloor,
  floor,
  outsideRoomId,
  manifest,
  resolvedBindings,
  deviceModels,
  reducedMotion,
  walkMode,
  onSelectRoom,
  sceneLightingEnabled,
}: RoomSelectionSurfacesProps) {
  const selectedRoomId = useContext(SceneRoomSelection);
  return (
    <>
      <HomeAssistantSceneLighting
        floor={sourceFloor}
        outsideRoomId={outsideRoomId}
        resolvedBindings={resolvedBindings}
        deviceModels={deviceModels}
        extensionDeviceModels={manifest.extensions.deviceModels}
        sceneItems={manifest.sceneItems}
        enabled={sceneLightingEnabled}
      />
      <FloorFinishSurfaces
        floor={floor}
        variant="scene"
        selectedRoomId={selectedRoomId}
        reducedMotion={reducedMotion}
        onSelectRoom={!walkMode ? onSelectRoom : undefined}
      />
    </>
  );
}
