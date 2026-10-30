---
name: Cabane web editor
description: A paper-toned workspace for constructing, arranging and connecting a home.
colors:
  preview-paper: "#f5f0e7"
  preview-ink: "#2e3835"
  preview-muted: "#6f7771"
  preview-accent: "#bd724d"
  connection-blue: "#365f6c"
  connection-selected: "#dce8e8"
  connection-surface: "#fffcf6"
  connection-muted: "#58675e"
  connection-green: "#315744"
  sage-rail: "#e9ece2"
  input-surface: "#eeefe8"
  filter-surface: "#efede5"
  pending: "#825914"
  unavailable: "#914c37"
  light-text: "#fff9ef"
  editor-button-surface: "#faf6ef"
  editor-button-hover: "#eae5d9"
  editor-line: "rgba(70, 70, 58, 0.14)"
typography:
  heading:
    fontFamily: '"Roboto", sans-serif'
    fontSize: "1.5rem"
    fontWeight: 600
  title:
    fontFamily: '"Roboto", sans-serif'
    fontSize: "1.25rem"
    fontWeight: 500
  body:
    fontFamily: '"Roboto", sans-serif'
    fontSize: "1rem"
    lineHeight: 1.5
  control:
    fontFamily: '"Roboto", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: '"Roboto", sans-serif'
    fontSize: "0.75rem"
  connection-body:
    fontFamily: '"Roboto", sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  connection-heading:
    fontFamily: '"Roboto", sans-serif'
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
rounded:
  control: "7px"
  field: "8px"
  row: "9px"
  connection: "10px"
  surface: "12px"
  connect-surface: "16px"
  dialog: "14px"
spacing:
  compact: "6px"
  control: "8px"
  row: "12px"
  section: "16px"
  workspace: "20px"
  panel: "24px"
  spacious: "28px"
components:
  button-default:
    backgroundColor: "{colors.editor-button-surface}"
    textColor: "{colors.preview-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-default-hover:
    backgroundColor: "{colors.editor-button-hover}"
    textColor: "{colors.preview-ink}"
  button-primary:
    backgroundColor: "{colors.preview-accent}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  connection-action:
    textColor: "{colors.connection-blue}"
    padding: "10px 0"
  search-field:
    backgroundColor: "{colors.input-surface}"
    textColor: "{colors.preview-ink}"
    rounded: "{rounded.field}"
    padding: "0 13px"
  type-filter:
    backgroundColor: "{colors.filter-surface}"
    textColor: "{colors.connection-muted}"
    rounded: "6px"
    padding: "7px 10px"
  type-filter-selected:
    backgroundColor: "{colors.connection-blue}"
    textColor: "white"
  source-surface:
    backgroundColor: "{colors.connection-surface}"
    textColor: "{colors.preview-ink}"
    rounded: "{rounded.surface}"
    padding: "20px 24px 16px"
  connect-source-surface:
    backgroundColor: "{colors.connection-surface}"
    textColor: "{colors.preview-ink}"
    rounded: "{rounded.connect-surface}"
    padding: "20px 24px 16px"
  source-row:
    textColor: "{colors.preview-ink}"
    rounded: "{rounded.row}"
    padding: "13px 10px"
  active-connection:
    backgroundColor: "{colors.connection-selected}"
    textColor: "{colors.preview-ink}"
    rounded: "{rounded.connection}"
    padding: "15px 12px"
---

# Design System: Cabane web editor

## Overview

**Creative North Star: "Cabane workspace"**

Cabane's editor uses warm paper, green-toned ink and quiet surfaces around the home. Roboto keeps tools and object information practical and compact. The home, catalog thumbnails and plan provide the imagery; the controls supply a readable working frame.

Connect extends this existing world with a sage device rail, blue connection selection and a pale source surface. Color and spacing separate working areas while labels explain the state of each object. This document records the implemented editor and its Connect and Properties patterns; it does not establish a new brand identity.

**Key Characteristics:**

- Warm paper surfaces and dark green-toned text.
- Compact English controls with clear object and connection names.
- Tonal grouping, restrained borders and soft corners.
- Model thumbnails and the existing SVG icon family.
- Independent visual treatment for selection, connection availability and model display.

## Colors

The palette combines warm neutrals with restrained terracotta, sage and blue-green functional accents. Frontmatter values are the extracted source values.

### Primary

- **Terracotta action** (`preview-accent`): the editor's filled primary actions.
- **Connection blue** (`connection-blue`): connection actions, active type filters and focus within the workbench. The existing Connect mode chrome has its own blue custom properties; retain those context-specific assignments.

### Secondary

- **Connection green** (`connection-green`): connected status text and reading confirmation actions.
- **Pending amber** (`pending`): a connection still to be chosen.
- **Unavailable clay** (`unavailable`): unavailable sources and destructive reading actions.

### Neutral

- **Warm paper** (`preview-paper`): the editor's main tools surface.
- **Green ink** (`preview-ink`): names, values and working text.
- **Muted editor ink** (`preview-muted`): supporting editor metadata.
- **Muted connection ink** (`connection-muted`): source context and secondary connection text.
- **Pale source paper** (`connection-surface`): the source picker, selected device and reading confirmation.
- **Sage rail** (`sage-rail`): the object navigation surface.
- **Blue selection wash** (`connection-selected`): the active connection.
- **Input and filter surfaces** (`input-surface`, `filter-surface`): local tool grouping inside the source surface.
- **Light action text**, **button paper**, **button hover** and **editor line**: existing editor button and divider treatments.

**The Separate States Rule.** Selection, source availability and display on the model have separate visual cues. Pair status color with a label or icon.

## Typography

**Body and control font:** Roboto with a sans-serif fallback. Use the incumbent shared editor scale for new editor chrome. The Connect workbench uses its extracted compact body role and smaller secondary metadata; these are local density choices.

### Hierarchy

- **Heading:** room and panel titles.
- **Title:** section and dialog titles.
- **Body:** general editor reading text.
- **Control:** buttons, field values and common interface labels.
- **Caption:** short metadata and supporting labels.
- **Connection body:** connection names and source-picker content; source identity and secondary information form separate lines.
- **Connection heading:** the shared room, object and source-column title role. Keep these headings aligned at their common top inset.

Use medium and semibold weights for object names and headings. Long object and source names wrap within their column. Values use tabular numerals where comparison matters. The existing Cabane brand treatment is separate from the application type hierarchy.

## Layout

The editor frames the home with tools and floating mode controls. Construct, Arrange and Connect share the standard tools sidebar. In Connect, it contains House plan, Refresh from HA and room navigation with shared connected/total counts. The house plan or room list opens a working area beside the sidebar. Floor selection remains on the plan view.

On wide screens, the Connect object rail is (217px) and the connection summary is (285px); the source picker receives the remaining width. The room, object and source headings use the shared connection-heading role and a common top inset. Opening a room leaves object selection empty. Choosing an object reveals its connections and readings; choosing a connection or reading opens the source picker.

Between (761px) and (1240px), the standard room sidebar and a (190px) device list remain visible while connections and sources use successive views. At (760px) and below, room navigation stays in the standard bottom Tools panel and the working area above it shows successive device, connection and source views with labeled return actions. Source and device lists own their scrolling on desktop; mobile lets the active workbench view scroll. The layout uses the spacing roles in frontmatter without imposing a strict grid on existing controls.

**The Stable Context Rule.** Preserve the selected object and named connection while searching or filtering sources. Keep search and type filters immediately above the flat source list.

## Elevation & Depth

Connect uses a restrained stack of working surfaces: sage devices behind warm-paper connections, then the brighter source picker. Adjacent layers overlap by 12px, with the scoped Connect surface radius and one soft directional shadow (`-12px 8px 28px -24px rgb(35 60 49 / 42%)`). Padding keeps labels, focus rings and actions clear of the overlapping edges. Heading baselines remain aligned. At intermediate widths only the device rail and active detail overlap; mobile resets overlap and shadows because one detail appears at a time. Existing floating editor controls retain their faint ambient shadow. Ordinary source rows gain a background on hover or selection rather than a new shadow.

Motion in source rows, connection rows and type filters is a short background transition (160ms, ease-out), enabled only when reduced motion is not requested. The sidecar records the exact observed shadows and transition.

Construct and Arrange on phones keep the canvas visible above a compact bottom dock. Tools, Catalog, Properties and Issues share one full-screen native dialog with a contextual title, underlined tabs and a Done action. Tool and catalog category cards use the existing SVG family on quiet paper surfaces. Catalog category navigation also applies on desktop; choosing a category reveals the full-width model grid with a clear Categories back action.

## Shapes

Controls, rows and working surfaces use softly curved corners with the extracted radii in frontmatter. Fields are compact, source rows span their available column, and broad surfaces use a gentler outer radius. Existing editor fields and buttons retain subtle borders. The source picker uses surface color to group its borderless controls.

## Components

### Buttons

Editor buttons use paper, a subtle line and green ink; the primary variant uses terracotta. Hover darkens the surface. Connect actions are blue text with a familiar SVG icon, and reading confirmation uses green for its submit action. Disabled actions reduce opacity and preserve their label. Focus is a visible outline with space around the control.

### Chips

Type filters are small rectangular buttons with softly rounded corners. A selected filter uses solid connection blue and white text. They wrap as a group above source results and expose their pressed state.

### Cards / Containers

The sage rail contains device navigation. In Connect, the warm-paper connection panel sits between that rail and the brighter source surface, using the scoped Connect surface radius and depth treatment. The source surface contains the current connection heading, tools, flat result list and footer. Device and source rows use compact, aligned identity text with optional model previews or category icons. The active connection uses the blue wash; selected source rows use a pale green treatment.

### Inputs / Fields

Source search is a borderless input inside a tinted field with a search icon. Focus outlines the containing field. Search accepts names, devices and IDs, while entity IDs remain an explicit reveal in the source footer. Properties fields retain the established bordered editor treatment.

### Navigation

Keep Construct, Arrange and Connect as labeled modes. The standard editor sidebar remains visible in Connect, listing rooms with connected/total counts and the House plan and Refresh from HA actions. The house plan gives spatial entry into Connect. The device rail uses catalog model thumbnails when available, an object name and a short status. Selecting a room leaves device details empty until an object is chosen; selecting a connection then opens its source picker. Column headings share top padding and the connection-heading role. Selecting an object preserves the stable surrounding columns. At intermediate widths, connections and sources use successive views beside the device list. Mobile retains rooms in the standard Tools panel below the work area, with Devices and Connections return actions at their respective steps.

### Connection and reading rows

Lead with the named function, then its selected source and a labeled availability status. Connect and Change are direct actions. In Properties, Show on model or Show state on model is a separate labeled switch with an eye icon and On/Off text. Optional reading actions appear after opening that reading's menu; renaming reveals the field in place.

Add reading chooses a compatible sensor before presenting its name and display settings. Source suggestions lead the flat list, with all other compatible choices following. Manual choices can cross Home Assistant areas; an area association informs suggestions without becoming an extra heading control.

## Do's and Don'ts

### Do:

- **Do** reuse the editor palette, Roboto and the existing model-thumbnail and SVG-icon systems.
- **Do** give connection, availability, selection and model display their own labeled cues.
- **Do** keep source search and type filters adjacent to the source list.
- **Do** align Connect column headings with the shared connection-heading role.
- **Do** keep mobile navigation sequential with clear return actions.
- **Do** reveal reading configuration after the corresponding action.

### Don't:

- **Don't** use status color as the only explanation of a connection's state.
- **Don't** expose entity IDs as the default source label.
- **Don't** turn every source row into an elevated card.
- **Don't** compress all three Connect columns into the mobile viewport.
- **Don't** replace the incumbent Cabane typography, palette or icon family when extending these surfaces.
