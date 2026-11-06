import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCabaneDom } from "@cabane/engine";
import type { EditorCameraState } from "../editor-connect/connect-navigation";
import type { ReadEditorCamera } from "../editor-preview/PreviewCamera";
import type { useHomeEditorController } from "./useHomeEditorController";
import type { useEditorPanels } from "./useEditorPanels";

type ConnectTarget = { kind: "device" | "slot"; id: string };
type ArrangePlace = {
  floorId: string;
  itemId: string;
  view: EditorCameraState["view"];
  camera: EditorCameraState | null;
  propertiesOpen: boolean;
  propertiesTarget: ConnectTarget | null;
};

export function useArrangeConnectReturn(
  controller: ReturnType<typeof useHomeEditorController>,
  panels: ReturnType<typeof useEditorPanels>,
  settingsMode: boolean,
) {
  const dom = useCabaneDom();
  const [origin, setOrigin] = useState<ArrangePlace | null>(null);
  const cameraReader = useRef<ReadEditorCamera | null>(null);
  const [cameraReturn, setCameraReturn] = useState<{
    key: number;
    pose: EditorCameraState | null;
  } | null>(null);
  const [returning, setReturning] = useState<{
    place: ArrangePlace;
    selectedId: string | null;
  } | null>(null);
  const {
    activeFloorId,
    cameraView,
    connect,
    constructEditor,
    editingLocked,
    floorNavigation,
    furnishingEditor,
    mode,
    savedCamera,
    selectMode,
    selectedItem,
    selectSceneItem,
    setCameraView,
    snapshot,
    unsettled,
  } = controller;
  const { restoreProperties } = panels;

  useEffect(() => {
    if (mode !== "connect" || settingsMode) setOrigin(null);
  }, [mode, settingsMode]);

  const openConnect = (target: ConnectTarget, fromProperties = false) => {
    if (mode !== "furnish" || settingsMode || !selectedItem || editingLocked || unsettled) return;
    const place: ArrangePlace = {
      floorId: activeFloorId,
      itemId: selectedItem.id,
      view: cameraView,
      camera: cameraReader.current?.() ?? savedCamera.current,
      propertiesOpen: panels.propertiesOpen,
      propertiesTarget: fromProperties ? target : null,
    };
    const opened =
      target.kind === "slot" ? connect.selectSlot(target.id) : connect.selectDevice(target.id);
    if (!opened) return;
    setOrigin(place);
    selectMode("connect", { preserveConnectTarget: true });
  };

  const backToArrange =
    mode === "connect" && !settingsMode && origin
      ? () => {
          if (editingLocked || unsettled) return;
          const { floorId, itemId } = origin;
          const item = snapshot.project.sceneItems.find(
            (candidate) => candidate.id === itemId && candidate.floorId === floorId,
          );
          if (item) selectSceneItem(itemId);
          else {
            if (snapshot.project.floors.some((floor) => floor.id === floorId))
              floorNavigation.selectFloor(floorId);
            furnishingEditor.select(null);
          }
          setReturning({ place: origin, selectedId: item?.id ?? null });
          setOrigin(null);
          selectMode("furnish", { replace: true });
        }
      : undefined;

  // A floor change replaces the local furnishing state before its selection is ready.
  useLayoutEffect(() => {
    if (
      !returning ||
      mode !== "furnish" ||
      constructEditor.draft.floorId !== activeFloorId ||
      furnishingEditor.selectedId !== returning.selectedId
    )
      return;

    const { place, selectedId } = returning;
    if (place.floorId === activeFloorId) {
      setCameraView(place.view);
      setCameraReturn((previous) => ({ key: (previous?.key ?? 0) + 1, pose: place.camera }));
    }
    restoreProperties(Boolean(selectedId) && place.propertiesOpen, Boolean(place.propertiesTarget));
    setReturning(null);

    requestAnimationFrame(() => {
      const target = place.propertiesTarget;
      const button = !selectedId
        ? null
        : target?.kind === "slot"
          ? Array.from(dom.root.querySelectorAll<HTMLButtonElement>("[data-connect-slot]")).find(
              (entry) => entry.dataset.connectSlot === target.id,
            )
          : dom.root.querySelector<HTMLButtonElement>(
              target ? "[data-connect-lighting]" : 'button[aria-label="Connect device"]',
            );
      (button ?? dom.root.querySelector<HTMLElement>('[aria-label="Home editor canvas"]'))?.focus({
        preventScroll: !target,
      });
    });
  }, [
    returning,
    mode,
    constructEditor.draft.floorId,
    activeFloorId,
    furnishingEditor.selectedId,
    setCameraView,
    restoreProperties,
    dom,
  ]);

  return { openConnect, backToArrange, cameraReader, cameraReturn };
}
