<p align="center">
  <img src="apps/web/public/cabane-icon.png" alt="Cabane" width="96" />
</p>

<h1 align="center">Cabane</h1>

<p align="center">Build your own 3D Home Assistant dashboard.</p>

<p align="center">
  <a href="https://cabane.my/demo">Try the demo</a> ·
  <a href="#installation">Install with HACS</a> ·
  <a href="#run-locally">Run locally</a>
</p>

<p align="center">
  <a href="https://paypal.me/hilliaapp">
    <img src="https://img.shields.io/badge/Buy_me_a_coffee-FFDD00?style=for-the-badge&logo=paypal&logoColor=000000" alt="Buy me a coffee to support Cabane via PayPal" />
  </a>
</p>

Draw your floor plan, furnish it, and connect it to Home Assistant. Explore your
home in 3D, see live device states, and control supported devices from the scene.
Use Cabane in your browser or directly in the Home Assistant sidebar.

|                                                   3D dashboard                                                   |                                         Built-in Home Editor                                         |                                                      First person mode                                                       |
| :--------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------: |
| [![Cabane demo home with simulated room states](docs/images/demo-dashboard.jpg)](docs/images/demo-dashboard.jpg) | [![Furnishing the demo home in Arrange](docs/images/demo-arrange.jpg)](docs/images/demo-arrange.jpg) | [![First-person view of the kitchen and dining room in Casa Solstice](docs/images/walk-view.jpg)](docs/images/walk-view.jpg) |

The dashboard and Built-in Home Editor show the bundled demo with simulated devices. First person mode
shows Casa Solstice from inside. Click any screenshot to enlarge.

## What you can do

- **Construct:** Draw rooms, walls, doors and windows in 2D. Add floors, stairs,
  floor finishes, terraces, boundaries and pools, or trace a reference plan.
- **Arrange:** Place furniture and smart devices from the built-in catalog in 2D
  or 3D. Resize and customize supported models, or import your own `.glb` files
  through **My models**.
- **Connect:** Link rooms to Home Assistant areas and objects to compatible
  entities. Use automatic matching or choose mappings yourself.
- **Explore and control:** Orbit the home, focus a room, or walk inside. Operate
  supported lights, covers, climate, fans, media players and other devices, view
  cameras, and add shortcuts for rooms, devices, scenes and scripts.
- **Keep multiple homes:** Create, duplicate, import and export workspaces. Save
  drafts separately from the published dashboard, with optional synchronization
  through your own Home Assistant instance.

> [!TIP]
> The [online demo](https://cabane.my/demo) works without installation or a Home
> Assistant connection. Its controls only change simulated devices.

## Installation

### HACS

Requires **Home Assistant 2024.7 or newer** and **HACS**. HTTPS is recommended.
The native sidebar panel also works over HTTP at the same origin as Home Assistant;
HTTP does not encrypt your traffic.

[![Open your Home Assistant instance and add the Cabane repository to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=cabane-app&repository=cabane-home-assistant&category=integration)

1. Click the button above, or open **HACS → ⋮ → Custom repositories**.
2. Add `https://github.com/cabane-app/cabane-home-assistant` with type **Integration**.
3. Download **Cabane**, then **restart Home Assistant**.
4. Open **Settings → Devices & services → Add integration → Cabane** and confirm.
5. Open **Cabane** from the sidebar. Explore the demo or create your own home.

> [!NOTE]
> The HACS package lives in the separate
> [Home Assistant integration repository](https://github.com/cabane-app/cabane-home-assistant).
> Cabane is currently a custom repository. The integration registers the sidebar
> panel and uses your existing Home Assistant session.

For manual installation, download `cabane.zip` from the
[latest integration release](https://github.com/cabane-app/cabane-home-assistant/releases/latest)
and extract its full contents, including `frontend/`, into
`/config/custom_components/cabane/`. Restart Home Assistant, then follow steps 4–5.

Update through HACS, restart Home Assistant, and reload your browser or Companion
app. See the [integration guide](https://github.com/cabane-app/cabane-home-assistant#install)
for troubleshooting.

### Browser

Open [cabane.my](https://cabane.my) to explore or build without installing the
integration. Connect to your Home Assistant HTTPS URL when ready. Device controls
work without the integration; install it to add the sidebar panel and workspace
storage.

## Build your home

1. Choose **Build** on the welcome screen, or **New workspace** in **Workspaces**.
2. Follow the tutorial in **Construct**, then furnish your rooms in **Arrange**.
3. In **Connect**, select your Home Assistant instance and map rooms and devices.
   Inside the native panel, choose **Use this Home Assistant**.
4. Click **Save** to publish the layout and mappings to your dashboard.

To open the same home on another device, enable sync in the workspace's
**Home Assistant** settings, then open the saved home from Home Assistant on the
other device. The website and native panel have separate browser storage; use
Home Assistant sync or a workspace export to move between them.
See [workspace setup and backups](docs/ha-workspace-storage-setup.md).

### Build with AI

Give your coding agent a floor plan or a description and let it build the home
in the open editor. You can watch the changes, adjust them yourself and use Undo.
The agent uses the same editing actions as Construct and Arrange.

1. Open Cabane **inside Home Assistant**, then create or choose a workspace.
2. In **Workspaces**, open that home's **••• → Connect LLM agent → Generate
   pairing code**.
3. Give your agent a checkout of this repository with Node.js and npm available
   (see [Run locally](#run-locally)). Run the pairing command shown by the panel
   from that checkout, then keep the editor open.
4. Give the agent your plan and dimensions, for example:
   “Use build-floor-layout to draw this unfurnished floor in my paired Cabane
   workspace. Check the layout and stop for my review.”

The agent can discover the available commands and inspect the draft with:

```sh
npm run agent:request -- --method get_capabilities --pretty
npm run agent:inspect -- --pretty
```

Pairing requires a matching agent-enabled frontend and HA integration (protocol
3). The browser and agent can run on different devices that can reach the same
HA instance. The one-use code grants temporary access to that workspace, without
giving the agent your HA access token. Edits autosave to the browser draft;
**Save** publishes them. See [agent pairing and commands](docs/product/agent-pilot.md)
for session lifetime and command details.

Cabane's agent skills live in this repository so they can evolve with the product.
Install a skill with the [Skills CLI](https://github.com/vercel-labs/skills), then
select your agent in the installer:

```sh
npx skills add cabane-app/cabane --skill create-cabane-model
```

| Skill                                                                  | Purpose                                                                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [create-cabane-model](.agents/skills/create-cabane-model/SKILL.md)     | Create a standalone GLB from a description or reference photo for import through Arrange → My models. No Cabane checkout is needed. |
| [build-floor-layout](.agents/skills/build-floor-layout/SKILL.md)       | Build an unfurnished floor in a paired HA workspace, or author floor JSON in a Cabane checkout.                                     |
| [equip-room](.agents/skills/equip-room/SKILL.md)                       | Furnish one accepted room from photos and descriptions in a Cabane checkout.                                                        |
| [build-catalog-presets](.agents/skills/build-catalog-presets/SKILL.md) | Author reusable built-in catalog presets in a Cabane checkout.                                                                      |
| [bootstrap-cabane](.agents/skills/bootstrap-cabane/SKILL.md)           | Install dependencies and start a local Cabane checkout.                                                                             |

Replace `create-cabane-model` in the command with the skill you want. Node.js and
npm are required for installation. Add `--global` to make the skill available
across projects. See the [home-generation workflow](docs/agent-home-generation.md)
for layout and room authoring.

The model skill includes [export guidance](.agents/skills/create-cabane-model/references/export.md),
Blender and Three.js examples, a [sample desk GLB](.agents/skills/create-cabane-model/examples/desk.glb),
and a Python validator. It and its bundled resources retain their
[MIT license](.agents/skills/create-cabane-model/LICENSE). Reference photos remain
inputs and may be processed by your chosen AI provider.

## Data and privacy

Homes and drafts are stored in your browser. Optional sync stores workspaces and
personal models on your Home Assistant instance, where all signed-in users can
access them. No Cabane account is required. The standalone app connects directly
to Home Assistant; the native panel uses its host session.

> [!IMPORTANT]
> Keep private workspace backups: clearing browser data can remove local homes.
> Backups include device mappings, but exclude sign-in credentials. Treat them as
> private household data. Synchronization is not a backup.

The public website records aggregate page views, excluding home contents and
Home Assistant data. Analytics is disabled by default in local and self-hosted
builds. See [runtime and privacy](docs/product/runtime-and-privacy.md).

## Run locally

Use the pinned **Node.js 24.11.1** and **npm 11.6.2** baseline. With nvm, run
`nvm install && nvm use` from the repository root first.

```sh
git clone https://github.com/cabane-app/cabane.git
cd cabane
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:4173`. The demo and
editors work locally without Home Assistant. A standalone Home Assistant connection
requires HTTPS for both endpoints; paired HTTP loopback origins are supported
for local development.

For a real local HA server with many fake devices, run `npm run ha:up`, then
complete onboarding at <http://127.0.0.1:8123> and connect your Cabane workspace
to that URL. Docker Compose is required. See the
[local Home Assistant guide](docs/local-home-assistant.md) for setup, lifecycle,
and the distinction between device testing and native panel/sync testing.

| Command               | Purpose                                                             |
| --------------------- | ------------------------------------------------------------------- |
| `npm run format`      | Format the workspace                                                |
| `npm run verify:fast` | Check formatting, lint, types, unused code and repository contracts |
| `npm run verify`      | Run the full static, test, furnishing and production-build checks   |
| `npm run build`       | Build the standalone app into `apps/web/dist`                       |
| `npm run build:panel` | Build the native panel into `apps/web/dist-panel`                   |

Before browser or full verification, install the pinned Chromium with
`npm run browser:install` (`-- --with-deps` on Linux if needed). Native panel
release builds require a clean, committed tree. See
[verification and delivery](docs/product/verification-and-delivery.md) for focused
checks, panel verification and deployment requirements.

### Recommended contributor seed

Import [Casa Solstice](home/showcase/furnished.project.json) through
**Workspaces → Import workspace → From file**, then **Save**. This furnished
two-level villa provides a repeatable starting point for catalog, layout and
device-control contributions. It does not replace existing workspaces or the
built-in demo. See the [local seed setup](docs/local-home-assistant.md#recommended-seed-casa-solstice)
for synthetic HA devices and synchronization, and the
[showcase reference](home/showcase/README.md) for architecture and validation.

### Measure scene rendering performance

`npm run measure:scene` records draw calls and triangles in Orbit, Walk,
Construct and Arrange. Keep reports in ignored `test-results/` and compare on the
same machine and browser. This check is separate from `verify`; its results do
not establish real-device frame rates.

## Project structure

Cabane is an npm workspace built with React, TypeScript, Three.js, React Three
Fiber and Vite.

| Path                       | Responsibility                                                                |
| -------------------------- | ----------------------------------------------------------------------------- |
| `apps/web`                 | Browser app, workspace library and Construct / Arrange / Connect editors      |
| `packages/engine`          | Project schema, persistence, validation, rendering and Home Assistant runtime |
| `packages/catalog`         | Reusable architecture, furniture and smart-device models                      |
| `packages/walk-laser`      | Optional first-person laser and portal experiment                             |
| `home`                     | Bundled demo project and home-specific model extensions                       |
| `docs`, `scripts`, `tests` | Product contracts, tooling and verification                                   |

Browser edits stay in the workspace; they do not rewrite `home/`. Source-authored
homes use the same portable project schema. See the [bundled home guide](home/README.md).

## Documentation

- [Product specification](PRODUCT_SPEC.md) — implemented features and focused contracts.
- [Architecture](docs/product/architecture.md) — main code areas, package boundaries and associated documentation.
- [Catalog](packages/catalog/README.md) and [personal models](docs/product/personal-models.md) — built-in models and GLB imports.
- [Home generation workflow](docs/agent-home-generation.md) — authoring layouts and rooms with an agent.
- [Agent skills](#build-with-ai) — floor layouts, room furnishing and standalone custom models.

## Easter egg: shoot the lights

The optional laser gun lets you toggle supported devices in first person mode.

<a href="docs/images/walk-laser.jpg">
  <img src="docs/images/walk-laser.jpg" alt="Laser gun toggling a light in Casa Solstice" width="480" />
</a>
