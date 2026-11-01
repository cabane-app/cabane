---
name: build-floor-layout
description: Build or revise one complete unfurnished Cabane floor from a plan or layout description. Use the paired Home Assistant editor for a browser workspace, or author FloorSpec JSON when source files are requested. Covers walls, rooms, openings, ceilings and navigation; furniture and device placement belong to equip-room.
---

# Build Floor Layout

Create one complete, unfurnished floor and leave it ready for the user's review.

## Choose the target

- For a paired native Home Assistant workspace, follow
  [the HA editor workflow](references/ha-editor-layout.md). The editor owns
  geometry, history and draft persistence; commands use the same actions as UI
  controls. This is the preferred route for bootstrapping a user's home.
- For an explicitly requested floor JSON file or source-authored bundled home,
  follow [the source workflow](references/source-layout.md). Its output stays
  in `home/` and uses the public layout validator.
- If neither the workspace nor source output is identified, establish that
  target before editing. Preserve existing architecture and unrelated work.

Read the repository `AGENTS.md` and relevant layout sections of `PRODUCT_SPEC.md`
when working from a checkout. Use public commands and the chosen workflow's
contract; inspect stable implementation only for an actionable diagnostic that
contradicts the contract or for explicit product development.

## Establish the architectural model

Inspect every supplied plan and written note. Later written corrections take
precedence over ambiguous graphics. Make an internal evidence table covering:

- every room and circulation space, including halls and closets;
- the outer footprint, shared boundaries and complete wall/junction topology;
- supplied measurements, scale anchors and inferred measurements;
- plan origin, axes and `metersPerPlanUnit`;
- interior/exterior wall classification;
- each opening, its owning wall, operation, hinge and swing;
- ceiling heights, stairs and walk routes; and
- material uncertainty or conflicting evidence.

Use supplied dimensions first, otherwise infer one coherent scale. All floors
in a V2 building share its coordinate transform. Walls own the architecture;
openings inherit wall facts, and walk collision derives from the same layout.
Generate the complete requested floor. Furniture symbols may inform scale or
room use; leave furniture, decor and ordinary devices for a later room task.

Ask a narrow question when uncertainty changes topology, opening ownership or
walk safety. Record the remaining assumptions for the handoff. Keep floor, room,
wall and opening identities stable across corrections.

## Build and verify

Follow the selected workflow through its validation and normal-UI review steps.
Completion requires every requested room and opening to be accounted for,
introduced architecture errors to be resolved, and the result to be visually
inspectable. Report missing APIs or verification prerequisites explicitly.

Use Cabane's paired relay only for the selected workspace's layout. Leave HA
entity mappings and device administration to separate user instructions.
Source output contains local labels and slots, without household identifiers.

## Handoff and stop

Summarize the room list and topology, coordinate system, supplied versus inferred
measurements, material assumptions, checks actually run and remaining uncertainty.
For a paired workspace, identify the workspace and floor and state that changes
are in its browser draft. For source output, list changed files and validation
markers. Confirm no mapping commands were sent and report any mapping effects
indicated by the draft diff.

Show an overview of the full floor and a walk view of its passages. Include
normal/grazing views for corrected junctions, openings or finishes. State which
views remain unverified when browser access is unavailable.

Ask for correction or approval of the unfurnished floor, then stop. Publish only
when the user requests Save. Furnishing requires a separate user instruction.
