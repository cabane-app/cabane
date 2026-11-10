import { useEffect, useState } from "react";
import type { BuildTutorialStep } from "@cabane/engine";
import { BuildTutorial } from "../editor-onboarding/BuildTutorial";
import { useBuildTutorial } from "../editor-onboarding/useBuildTutorial";
import type { useHomeEditorController } from "./useHomeEditorController";

export function useEditorBuildTutorial(
  {
    editorProject,
    mode,
    workspace,
    reference,
    editingLocked,
    unsettled,
    constructEditor,
    publishOpen,
    previewOpen,
    floorNavigation,
    selectMode,
    activeFloorId,
    focusRoom,
  }: ReturnType<typeof useHomeEditorController>,
  closeMobilePanel: () => void,
) {
  const tutorial = useBuildTutorial(
    editorProject,
    mode,
    Object.keys(workspace.snapshot.references ?? {}).length > 0,
  );
  const [nameFocusRequest, setNameFocusRequest] = useState<{
    roomId: string;
    serial: number;
  } | null>(null);
  const [tutorialAction, setTutorialAction] = useState<{
    step: BuildTutorialStep;
    target?: { floorId: string; roomId: string };
  } | null>(null);
  const tutorialBusy =
    (tutorial.state?.step === "reference" && !reference.storage.ready) ||
    editingLocked ||
    unsettled ||
    Boolean(constructEditor.drawStart) ||
    publishOpen ||
    previewOpen;
  const activateTutorial = () => {
    const state = tutorial.state;
    if (!state || tutorialBusy) return;
    if (state.step === "reference") {
      reference.openPicker();
      return;
    }
    if (state.step === "arrange" && mode === "furnish") {
      tutorial.ready();
      return;
    }
    const nextMode =
      state.step === "arrange" ? "furnish" : state.step === "connect" ? "connect" : "construct";
    if (state.target) floorNavigation.selectFloor(state.target.floorId);
    selectMode(nextMode);
    closeMobilePanel();
    setTutorialAction({
      step: state.step,
      ...(state.target === undefined ? {} : { target: state.target }),
    });
  };
  const tutorialPanel = tutorial.state?.status === "active" && (
    <BuildTutorial
      state={tutorial.state}
      mode={mode}
      disabled={tutorialBusy}
      warning={tutorial.warning}
      onAction={activateTutorial}
      onSkip={tutorial.skip}
      onDismiss={tutorial.dismiss}
    />
  );
  useEffect(() => {
    if (!tutorialAction || tutorialBusy) return;
    const { step, target } = tutorialAction;
    const desiredMode =
      step === "arrange" ? "furnish" : step === "connect" ? "connect" : "construct";
    if (
      mode !== desiredMode ||
      (target &&
        (activeFloorId !== target.floorId || constructEditor.previewFloor.id !== target.floorId))
    )
      return;
    if (target) focusRoom(target.roomId);
    if (step === "walls") constructEditor.setTool("wall");
    if (step === "door" || step === "window") constructEditor.setTool(step);
    if (step === "name" && target) {
      constructEditor.setTool("select");
      constructEditor.selectRoom(target.roomId);
      setNameFocusRequest({ roomId: target.roomId, serial: Date.now() });
    }
    setTutorialAction(null);
  }, [
    tutorialAction,
    tutorialBusy,
    mode,
    activeFloorId,
    constructEditor.previewFloor.id,
    constructEditor,
    focusRoom,
  ]);
  return {
    tutorialPanel,
    tutorialBusy,
    restartTutorial: tutorial.restart,
    nameFocusRequest,
    onNameFocusHandled: () => setNameFocusRequest(null),
  };
}
