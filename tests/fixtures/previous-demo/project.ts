import { composeHomeManifest, parseHomeProject } from "@cabane/engine";
import { homeExtensions } from "@cabane/home";
import layout from "./layout.json";
import sceneItems from "./items.json";
import metadata from "./project.json";

// The checked-in seed uses the same schema and parser as a portable workspace import.
const result = parseHomeProject(JSON.stringify({ ...metadata, ...layout, sceneItems }));
if (!result.valid) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
export const ownerHomeProject = result.project;
export const homeManifest = composeHomeManifest(ownerHomeProject, homeExtensions);
