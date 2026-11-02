import { useEffect, useId, useRef, useState } from "react";
import { useCabaneDom } from "@cabane/engine";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import illustration from "./assets/photo-to-model.png";
import "./model-generation-guide.css";

const skillRepository =
  "https://github.com/cabane-app/cabane/tree/main/.agents/skills/create-cabane-model";
const installCommand = "npx skills add cabane-app/cabane --skill create-cabane-model";

export function ModelGenerationGuide({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: () => void;
}) {
  const dom = useCabaneDom();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "unavailable">("idle");
  useEffect(() => {
    const previous = dom.root.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal?.();
    return () => {
      element?.close?.();
      if (previous?.isConnected) previous.focus();
    };
  }, [dom]);
  return (
    <dialog
      ref={dialog}
      className="model-generation-guide"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id={titleId}>Generate a custom model</h2>
        <EditorButton variant="text" aria-label="Close generation guide" onClick={onClose}>
          <EditorIcon name="close" />
        </EditorButton>
      </header>
      <p id={descriptionId}>
        Make furniture, devices, or any object with your own AI tool. Start from a description or a
        photo of something real.
      </p>
      <img
        className="model-generation-illustration"
        src={illustration}
        alt="An armchair reference photo becoming a matching 3D model"
        width={960}
        height={640}
      />
      <ol className="model-generation-steps">
        <li>
          <h3>Install the skill</h3>
          <p>
            The skill guides your AI to create a ready-to-import GLB file.{" "}
            <a href={skillRepository} target="_blank" rel="noopener noreferrer">
              View the skill on GitHub
            </a>
            .
          </p>
          <p>Run this command in a terminal in your working folder:</p>
          <pre className="model-generation-command">
            <code>{installCommand}</code>
          </pre>
          <EditorButton
            variant="primary"
            onClick={() => {
              if (!navigator.clipboard) {
                setCopyStatus("unavailable");
                return;
              }
              void navigator.clipboard
                .writeText(installCommand)
                .then(() => setCopyStatus("copied"))
                .catch(() => setCopyStatus("unavailable"));
            }}
          >
            {copyStatus === "copied" ? "Copied" : "Copy command"}
          </EditorButton>
          {copyStatus === "unavailable" && <p role="status">Select and copy the command above.</p>}
          <p>
            Select Codex, Claude Code, Cursor, or another supported agent in the installer, then
            start a new session.
          </p>
          <p className="model-generation-note">
            Node.js and npm are required. For another AI tool, share <code>SKILL.md</code> from the
            repository and ask it to follow the instructions.
          </p>
        </li>
        <li>
          <h3>Describe your model or share a photo</h3>
          <p>
            Ask your AI to use <code>create-cabane-model</code>. Include real dimensions if you know
            them.
          </p>
          <blockquote>
            “Use create-cabane-model to make a GLB of the armchair in this photo. It is 80 cm wide.”
          </blockquote>
          <p>
            Import the .glb here when it is ready. Review its size and orientation, then add it to
            My models.
          </p>
        </li>
      </ol>
      <footer>
        <EditorButton variant="text" onClick={onClose}>
          Done
        </EditorButton>
        <EditorButton onClick={onImport}>Import model (.glb file)</EditorButton>
      </footer>
    </dialog>
  );
}
