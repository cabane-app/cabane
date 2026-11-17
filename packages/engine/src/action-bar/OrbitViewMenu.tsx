import { SceneActionButton } from "./SceneActionButton";
import topDownIcon from "../assets/scene-actions/top-down.svg";
import resetViewIcon from "../assets/scene-actions/reset-view.svg";
import lockViewIcon from "../assets/scene-actions/lock-view.svg";
export function OrbitViewMenu({
  locked,
  disabled,
  onTopDown,
  onResetView,
  onToggleLock,
  onClose,
}: {
  locked: boolean;
  disabled: boolean;
  onTopDown: (() => void) | undefined;
  onResetView: (() => void) | undefined;
  onToggleLock: (() => void) | undefined;
  onClose: () => void;
}) {
  return (
    <>
      {" "}
      {[
        { label: "Top-down", action: onTopDown, icon: topDownIcon },
        { label: "Reset view", action: onResetView, icon: resetViewIcon },
        {
          label: "Lock view",
          action: onToggleLock,
          icon: lockViewIcon,
        },
      ].map(
        ({ label, action, icon }) =>
          action && (
            <SceneActionButton
              key={label}
              label={label}
              active={label === "Lock view" && locked}
              disabled={disabled}
              icon={<img src={icon} alt="" draggable={false} />}
              onClick={() => {
                action();
                onClose();
              }}
            />
          ),
      )}
    </>
  );
}
