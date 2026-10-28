import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ModelImportDialog } from "../apps/web/src/custom-models/ModelImportDialog";
import "@cabane/engine/styles.css";
import "../apps/web/src/home-editor.css";

/** Minimal real-canvas fixture: behavior matrices stay in Node/DOM tests. */
export function mountModelEditor(bytes: number[]) {
  const container = document.createElement("div");
  container.className = "direction-preview";
  document.body.append(container);
  const file = new File([new Uint8Array(bytes)], "Preview cabinet.glb", {
    type: "model/gltf-binary",
  });
  function Harness() {
    const [open, setOpen] = useState(true);
    return open ? (
      <ModelImportDialog
        file={file}
        missingModelOptions={[]}
        onCancel={() => setOpen(false)}
        onImport={async () => setOpen(false)}
      />
    ) : (
      <p>Editor closed</p>
    );
  }
  createRoot(container).render(<Harness />);
}
