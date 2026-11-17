import { parseHomeProject } from "@cabane/engine";
import larchObservatory from "../dev-workspaces/larch-observatory.project.json";

// Reuse the portable local design without changing the saved development workspace.
const result = parseHomeProject(
  JSON.stringify({
    ...larchObservatory,
    home: { ...larchObservatory.home, id: "demo-larch-observatory" },
  }),
);
if (!result.valid) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
export const showcaseHomeProject = result.project;
