import { homeManifest, ownerHomeProject } from "./previous-demo/project";
import { editorBindingsForManifest } from "../../apps/web/src/project-runtime";
export { homeManifest, ownerHomeProject } from "./previous-demo/project";
export { homeExtensions } from "@cabane/home";
export const ownerProjectManifest = homeManifest;
export const ownerEditorResolvedBindings = editorBindingsForManifest(homeManifest);
export const ownerSceneDeviceItems = ownerHomeProject.sceneItems.filter(
  (item) => item.kind === "device",
);
