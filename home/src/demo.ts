import { parseHomeProject } from "@cabane/engine";
import atelier from "../showcase/atelier.project.json";

// Share the portable showcase source so the published demo cannot drift from it.
const result = parseHomeProject(JSON.stringify(atelier));
if (!result.valid) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
export const demoHomeProject = result.project;
