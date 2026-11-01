---
version: 1
slug: "src-editor-connect-connect-workspace-css"
primary_target: "src/editor-connect/connect-workspace.css"
# Keep the list on one line for the surface-brief reader.
# prettier-ignore
related_targets: ["src/editor-connect/ConnectInspector.tsx","src/editor-preview/furnish/ItemEntitySlots.tsx"]
---

# Connect workspace

Mode: Operate. Approved by the user: Option A and the shared Properties proposal. Keep existing product truth and the English interface. Code-led implementation, with the approved interactive proposal as the visual reference.

## Direction contract

THESIS: Keep the standard editor sidebar for rooms and their connection counts. Choose a room on the plan or in the sidebar, then connect its objects in a stable workspace. Replace the narrow inspector and nested candidate lists.

OWN-WORLD: Existing Cabane Roboto, paper background, sage device rail, blue active connection, pale source surface. Reuse catalog model thumbnails and the existing icon family. Space and surface color establish groups.

STORY: Plan → room → object → named connection → eligible source. The selected source, availability and model visibility remain distinct. Add reading chooses a sensor before asking for its name.

FIRST VIEWPORT: Standard Cabane sidebar with room navigation, connected/total counts, House plan and Refresh actions. To its right, the room device list, selected object connections and selected source picker share aligned headings. Device and source details appear only after explicit selection. Suggested sources lead a flat list; search and type filters stay above it. Intermediate widths use successive connection and source views beside the device list. Mobile keeps standard Tools for room navigation below successive device, connection and source views.

FORM: User-selected Option A. Seed key: not applicable, explicitly approved composition.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Follow-up confirmed by the user: hide the floor picker inside the selected room and remove the HA-area control from its heading. Existing area associations may suggest sources but never limit explicit compatible choices.

Scope: Connect and connection controls in Arrange Properties. Preserve typed compatibility, slot identities, ordinary history, Outside rooms and opening controls. No deployment or release is authorized by the layout choice.

User refinement: retain the incumbent sidebar even in a selected room; no automatic device or connection selection. All workspace column headings use one 20px/26px, weight-600 Roboto style; the sidebar uses editor tokens.

Surface refinement approved by the user: the three working panels form a subtle overlapping stack. Sage devices sit behind warm paper connections, then a brighter source surface. Use 12px overlap, 16px corners and a soft directional shadow; keep titles aligned and controls clear of the seams. Disable overlap and shadows on mobile where one detail view appears at a time.
