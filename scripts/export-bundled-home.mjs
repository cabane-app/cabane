import { readFile } from "node:fs/promises";

process.stdout.write(
  await readFile(new URL("../home/showcase/atelier.project.json", import.meta.url), "utf8"),
);
