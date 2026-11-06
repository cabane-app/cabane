import { composeHomeManifest } from "@cabane/engine";
import { demoHomeProject } from "./demo";
import { homeExtensions } from "./extensions";

export { demoHomeProject, homeExtensions };
export const homeManifest = composeHomeManifest(demoHomeProject, homeExtensions);
