import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { captureOptions } from "./dev-agent-camera.mjs";

export async function captureDevAgent({ page, execute, root }, input, multiple = false) {
  const options = captureOptions(input, multiple);
  const inspection = await execute({ method: "inspect_workspace" });
  const item = options.itemId
    ? inspection.project.sceneItems.find((item) => item.id === options.itemId)
    : null;
  if (options.itemId && !item) throw new Error(`Item ${options.itemId} was not found.`);
  if (item && options.floorId && item.floorId !== options.floorId)
    throw new Error("The item does not belong to the requested floor.");
  const floorId = options.floorId ?? item?.floorId ?? inspection.activeFloorId;
  if (floorId !== inspection.activeFloorId)
    await execute({
      method: "execute_action",
      params: { action: { type: "select-floor", floorId } },
    });
  await page.evaluate(async () => {
    if (!window.cabaneDevPrepareCapture) throw new Error("The development editor is not open.");
    await window.cabaneDevPrepareCapture();
  });
  const target = options.itemId
    ? `scene-item-${options.itemId}`
    : (options.objectName ?? `building-floor-${floorId}`);
  const moduleUrl = `/@fs${join(root, "scripts/dev-agent-capture-browser.mjs")}`;
  const deadline = Date.now() + options.timeoutMs;
  const probe = (params, timeoutMs = Math.max(1, deadline - Date.now())) =>
    page.evaluate(async ({ moduleUrl, params }) => (await import(moduleUrl)).captureScene(params), {
      moduleUrl,
      params: { timeoutMs, ...params },
    });
  const original = await probe({ operation: "read" });
  const captures = [];
  const errors = [];
  let failure;
  let output;
  const onError = (error) => errors.push(error.message);
  page.on("pageerror", onError);
  const directory = multiple
    ? resolve(root, options.directory ?? join("test-results/dev-agent/captures", randomUUID()))
    : null;
  try {
    if (multiple) await mkdir(directory, { recursive: true });
    for (const view of options.views) {
      const result = await probe({
        operation: multiple ? "capture" : "frame",
        target,
        view,
        padding: options.padding,
      });
      const { png, ...framing } = result;
      if (!multiple) return { floorId, target, ...framing };
      const path = join(directory, `${view.name}.png`);
      if (!png?.startsWith("data:image/png;base64,"))
        throw new Error("The editor did not return a PNG capture.");
      await writeFile(path, Buffer.from(png.slice("data:image/png;base64,".length), "base64"));
      captures.push({ ...framing, path });
    }
    if (errors.length) throw new Error(`Scene errors: ${errors.join("; ")}`);
    const result = { floorId, target, draftRevision: inspection.draftRevision, captures };
    const manifest = join(directory, "capture.json");
    await writeFile(manifest, JSON.stringify(result, null, 2));
    output = { ...result, manifest };
  } catch (error) {
    failure = Object.assign(error, { captures });
  } finally {
    page.off("pageerror", onError);
    if (multiple && options.restore !== false) {
      try {
        await probe({ operation: "restore", pose: original }, 5000);
      } catch (error) {
        if (failure) failure.restoreError = error.message;
        else failure = Object.assign(error, { captures });
      }
    }
  }
  if (failure) throw failure;
  return output;
}
