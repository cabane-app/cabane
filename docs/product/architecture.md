---
areas:
  workspaces:
    code: [apps/web/src/workspaces/, apps/web/src/panel/, packages/engine/src/home-project/]
    docs: [docs/product/journey.md, docs/product/workspace.md]
  editor:
    code:
      [apps/web/src/editor-workspace/, apps/web/src/editor-preview/, apps/web/src/editor-connect/]
    docs: [docs/product/construct.md, docs/product/arrange.md, docs/product/connect.md]
  home_assistant:
    code: [packages/engine/src/HomeAssistantRuntime.tsx, packages/engine/src/command-scheduler.ts]
    docs: [docs/product/runtime-and-privacy.md]
  dashboard:
    code:
      [
        packages/engine/src/CabaneDashboard.tsx,
        packages/engine/src/home-assistant-dashboard/,
        packages/engine/src/navigation/,
      ]
    docs: [docs/product/dashboard-and-cameras.md]
  rendering:
    code:
      [
        packages/engine/src/architecture-scene/,
        packages/engine/src/rendering.tsx,
        packages/engine/src/styles.css,
      ]
    docs: [docs/product/geometry-and-rendering.md]
  catalog:
    code: [packages/catalog/src/]
    docs: [docs/product/catalog-and-extensions.md, packages/catalog/README.md]
  personal_models:
    code: [apps/web/src/custom-models/, packages/engine/src/imported-models/]
    docs: [docs/product/personal-models.md]
  model_lighting:
    code: [apps/web/src/model-lighting/, packages/engine/src/model-lighting/]
    docs: [docs/product/model-lighting.md]
  walk_tools:
    code: [apps/web/src/walk-tools.ts, packages/walk-laser/src/, packages/engine/src/walk-tools/]
    docs: [docs/product/dashboard-and-cameras.md#walk-tool-extensions]
  agent_relay:
    code: [apps/agent-cli/src/, apps/web/src/agent-pilot/]
    docs: [docs/product/agent-pilot.md]
  home_generation:
    code: [home/src/]
    docs: [home/README.md, docs/agent-home-generation.md, docs/product/generation.md]
  verification_and_delivery:
    code: [scripts/, tests/]
    docs: [docs/product/verification-and-delivery.md, docs/test-guidelines.md]
---

# Architecture

The frontmatter links each main area to code entry points and existing documentation.
All frontmatter paths are relative to the repository root. Follow the relevant
`docs` entry for behavior and compatibility; [PRODUCT_SPEC.md](../../PRODUCT_SPEC.md)
indexes the product contracts.

Cabane is a client-side React/Three.js application in an npm workspace:

- `apps/web` owns startup, standalone and Home Assistant panel hosting, the workspace
  library, routes, and the Construct, Arrange and Connect editors.
- `packages/engine` owns project schemas, validation, persistence, geometry,
  rendering, dashboard controls, navigation and Home Assistant runtime integration.
- `packages/catalog` supplies reusable architecture, furniture and device definitions.
- `packages/walk-laser` supplies the optional walk tool installed by the web host.
- `apps/agent-cli` sends guarded editor commands through the Home Assistant agent relay.
- `home` supplies the bundled demo project and home-specific model extensions.

## Boundaries

The web host mounts a runtime and editor scoped to one workspace. Editor changes
stay in its draft until Save publishes them. Browser edits persist in the workspace;
source-authored homes live in `home/`. The bundled home seeds an ordinary demo
workspace and uses the same portable project schema as other homes.

Cross-package consumers use public exports from workspace `package.json` manifests.
The engine exposes `@cabane/engine` and `@cabane/engine/styles.css`; the catalog
exposes `@cabane/catalog/architecture`, `@cabane/catalog/furnishing`, and
`@cabane/catalog/device`. The web host installs optional walk tools, keeping them
outside the engine, catalog and home dependencies.

Portable projects use local binding slots. Home Assistant credentials and household
mappings belong to the authenticated browser runtime and private workspace data.
See [runtime and privacy](runtime-and-privacy.md) for those boundaries.

## Keeping this guide current

Update the affected entry when a code area moves or its documentation changes.
Keep detailed behavior in the linked product contract and public exports in package
manifests. Local check selection follows [AGENTS.md](../../AGENTS.md#workflow);
commands, CI and release requirements live in [verification and delivery](verification-and-delivery.md).
