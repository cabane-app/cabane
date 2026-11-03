import "@cabane/engine/styles.css";
import "../apps/web/src/app-shell.css";
import "../apps/web/src/home-editor.css";
import "../apps/web/src/editor-workspace/editor-panels.css";
import "../apps/web/src/editor-workspace/mobile-editor-panels.css";
import { createRoot } from "react-dom/client";
import { ModelImportDialog } from "../apps/web/src/custom-models/ModelImportDialog";

export function mountImportDialog(bytes: readonly number[]) {
  const root = createRoot(document.getElementById("root")!);
  const file = new File([Uint8Array.from(bytes)], "Poses.glb", { type: "model/gltf-binary" });
  root.render(
    <div className="direction-preview" data-editor-mode="furnish">
      <ModelImportDialog
        file={file}
        missingModelOptions={[]}
        onImport={async () => {
          throw new Error("The layout fixture does not publish models.");
        }}
        onCancel={() => root.unmount()}
      />
    </div>,
  );
}
