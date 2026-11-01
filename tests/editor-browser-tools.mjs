/** Select the real toolbar tool, including its disclosure when grouped. */
export async function selectConstructionTool(page, label) {
  const toolbar = page.getByRole("group", { name: "Construction actions", exact: true });
  const group = ["Wall", "Invisible wall", "Outdoor space"].includes(label)
    ? { label: "Wall", panel: "Wall tools" }
    : ["Door", "Passage", "Window"].includes(label)
      ? { label: "Openings", panel: "Opening tools" }
      : null;
  if (!group) {
    await toolbar.getByRole("button", { name: label, exact: true }).click();
    return;
  }
  const trigger = toolbar.getByRole("button", { name: group.label, exact: true });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await page
    .getByRole("group", { name: group.panel, exact: true })
    .getByRole("button", { name: label, exact: true })
    .click();
}
