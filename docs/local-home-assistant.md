# Local Home Assistant test server

Run a real Home Assistant with synthetic entities alongside Cabane. Docker with
Compose is required (Docker Desktop or Colima on macOS). No household HA instance
or credentials are needed.

```sh
npm run ha:up
npm run dev
```

The first run downloads the pinned HA image and Cabane integration source, then
builds the native panel from this checkout. It can take several minutes. Git,
Node and installed npm dependencies are required in addition to Docker.
`ha:up` waits for the HTTP server to become healthy. Open
<http://127.0.0.1:8123> and complete HA onboarding with a **local test account**.
Skip optional integration discovery. Keep that password in your password manager.
The checked-in configuration uses synthetic coordinates.

Open Cabane at <http://127.0.0.1:4173>, create a personal workspace with **Build**,
then open its **Home Assistant** settings. Enter `http://127.0.0.1:8123`, click
**Connect**, and sign in with the test account. Use **Connect** mode to map the
demo entities to your home. The built-in **Explore the demo** workspace stays
simulated and does not connect to this server.

Both URLs must use loopback HTTP on the same machine. If Vite selects a different
port, free port 4173 and restart it, or add that exact origin to
`dev/home-assistant/configuration.yaml` and restart HA.

## Recommended seed: Casa Solstice

Use the checked-in [furnished Casa Solstice project](../home/showcase/furnished.project.json)
as the default starting point for contributor testing. Import it through
**Workspaces → Import workspace → From file**, review it, and **Save**.
This is an explicit import, not automatic startup seeding: existing homes and
accounts remain intact. The same file works in standalone Vite and the native
HA panel. It contains two levels, four bedrooms, two bathrooms, a garden, pool,
209 scene items and 62 device slots, including electric-car telemetry.

The single seed includes the complete architecture and furnishings, with no HA
entity identifiers or credentials.
Without HA mappings, they are useful for visual, catalog and editor work;
importing the design alone does not connect its device controls.

After starting the local HA server and completing onboarding, install the
optional synthetic showcase entities from the repository root:

```sh
node dev/home-assistant/showcase/install.mjs
npm run ha:check
```

The installer checks the existing loopback test container, adds the fixture to
its persistent configuration and restarts that container. It preserves its
account, volume and workspaces. Because the Compose project is shared across
checkouts, it updates the configuration mounted by the currently running test
instance; do not run it against a household HA server.

In the imported workspace's **Home Assistant** settings, connect to the local
server (or select **Use this Home Assistant** in the native panel). In **Connect**,
map rooms and device slots to the discovered synthetic areas/entities. Entity
IDs are allocated by HA and must not be assumed to match another contributor's
installation. The fixture alone does not create these mappings on a fresh
checkout. Save, then enable HA sync to reuse the mapped home from either client
via **Workspaces → Import workspace → From Home Assistant**.

Keep your mapped workspace backup and optional runtime plan under ignored
`test-results/showcase/`; never commit account data or HA mappings. See the
[showcase reference](../home/showcase/README.md) for fixture details, validators
and known simulation limitations. For a contribution, check both floors and the
affected objects or controls; importing this seed does not substitute for the
checks required by your change.

## What is available

The [official HA Demo integration](https://www.home-assistant.io/integrations/demo/)
loads fake lights, switches, covers, climate, sensors, fans, locks, media players,
cameras, vacuums, weather, and other platforms. Controls use HA's real service and
WebSocket APIs; simulated behavior varies by platform. These entities do not
establish real hardware or camera-stream compatibility. Some demo assets may
require internet access.

## Native panel and local development

Cabane is installed automatically from the commit pinned in `scripts/ha-dev.mjs`.
The YAML configuration imports its integration entry on startup. After HA
onboarding, open **Cabane** in the sidebar or <http://127.0.0.1:8123/cabane>.
It uses your HA session; no second login or token is needed.

```sh
npm run ha:refresh
```

This rebuilds the panel from the current checkout, including uncommitted edits,
stops the test HA, replaces its integration and frontend, and starts it again.
Reload the browser afterward. This is a build/restart workflow, not Vite HMR.
`ha:up` reuses the installed build; use `ha:refresh` after changing frontend code
or switching checkouts. A failed build leaves the running installation alone.

To test an integration change alongside the panel, pass its local checkout:

```sh
npm run ha:refresh -- --integration-source /path/to/cabane-home-assistant
```

Generated integration files live under ignored `test-results/ha-dev/`. Only this
local copy receives a small adapter allowing development-marked bundles when
`CABANE_LOCAL_DEVELOPMENT=1` is set in the test container. Asset checksums and
inventory validation still apply. Upstream integration and release gates remain
unchanged. Never distribute this local installation as a release.

## Try workspace synchronization

1. In the native panel, create a personal workspace with **Build**.
2. Open its **Home Assistant** settings and choose **Use this Home Assistant**.
3. Click **Enable sync**, then publish a small home with **Save**.
4. Open standalone Cabane at <http://127.0.0.1:4173> in another browser or profile.
   Choose **Workspaces → Import workspace → From Home Assistant**, sign in to
   `http://127.0.0.1:8123`, and select the saved home.
5. Edit and save in one client; verify the change arrives in the other with
   automatic sync enabled. Keep only one client editing at a time unless testing
   conflict handling.

HA stores workspaces and personal models in the persistent Docker volume. Both
clients must select this same HA instance; browser storage is separate. The
built-in Cabane demo intentionally cannot be synchronized. Fake devices are
already supplied by `demo:` in the HA YAML; no additional developer-mode toggle
is necessary.

## Lifecycle and data

```sh
npm run ha:logs   # Follow server logs (Ctrl-C only stops following)
npm run ha:check  # Validate HA configuration in the running container
npm run ha:down   # Stop the server; retain the test account and HA state
npm run ha:up     # Start it again
npm run ha:refresh # Rebuild local Cabane and restart HA
```

After editing the YAML, run `ha:check`, then `ha:down` and `ha:up`.
HA state, authentication and history live in the Docker volume
`cabane-ha-dev_config`, outside Git. The configuration file is mounted read-only.
The fixed Compose project name intentionally shares one test instance across
checkouts; stop it before switching to another checkout's configuration.
The server binds only to `127.0.0.1:8123`, with no host networking, privileged
mode, hardware mounts or automatic LAN discovery. It does not restart on boot.

To **erase only this test server's account and state**, run:

```sh
docker compose -f dev/home-assistant/compose.yaml down --volumes
```

This does not erase Cabane's browser workspaces. If port 8123 is occupied, stop
the conflicting local service or change the host port in Compose and use that
port in Cabane. Update the pinned image in `compose.yaml` deliberately and repeat
the connection/control smoke test when upgrading HA.
