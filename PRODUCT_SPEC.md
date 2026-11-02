# Cabane product specification

Cabane turns a modeled home into an interactive 3D Home Assistant dashboard.
Users can explore the home, edit its architecture and furnishings in the browser,
connect modeled rooms/devices to HA, and operate supported controls. The bundled
owner home is already furnished and initializes one ordinary demo workspace.
Users can create, switch, duplicate, import, export, and delete independent homes.

This master file and the linked specifications describe the implemented product.
When implementation changes, update the relevant focused spec with it.

| Product area | Current high-level contract                                                                        | Detailed specification                                               |
| ------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Ownership    | Web shell, reusable engine/catalog, owner home package                                             | [Architecture](docs/product/architecture.md)                         |
| User journey | Workspace library, per-home dashboard and editor routes                                            | [Startup and setup](docs/product/journey.md)                         |
| Workspace    | Multiple browser-local homes, independent connections, drafts, atomic Apply and recovery           | [Data and persistence](docs/product/workspace.md)                    |
| Construct    | 2D wall/room/opening editing, floor finishes, outdoor platforms, pools, measuring and diagnostics  | [Construction](docs/product/construct.md)                            |
| Arrange      | Catalog browsing, supported placement, item editing and duplication                                | [Arrangement](docs/product/arrange.md)                               |
| Connect      | Room/area and device/slot mapping, automatic matching, imports and backups                         | [Connections](docs/product/connect.md)                               |
| Runtime      | Browser OAuth/WebSocket integration, guarded controls, private browser data                        | [Runtime and privacy](docs/product/runtime-and-privacy.md)           |
| Dashboard    | Overview/room/walk interactions, domain controls and camera media                                  | [Dashboard and cameras](docs/product/dashboard-and-cameras.md)       |
| Scene        | Procedural toon architecture, finishes, lighting, derived walk collision                           | [Geometry and rendering](docs/product/geometry-and-rendering.md)     |
| Models       | Stable registries and code-defined owner extensions                                                | [Catalog contracts](docs/product/catalog-and-extensions.md)          |
| My models    | Per-home GLB catalog, preserved materials, portable assets and HA synchronization                  | [Personal models](docs/product/personal-models.md)                   |
| Generation   | Accepted layout followed by room equipment; local typed slots, explicit review gates               | [Agent workflow](docs/product/generation.md)                         |
| Agent pilot  | HA-panel pairing for external agents to inspect and make guarded draft edits in the open workspace | [Home Assistant agent relay](docs/product/agent-pilot.md)            |
| Delivery     | Automated checks and static build; incomplete deployment/household acceptance called out           | [Verification and limits](docs/product/verification-and-delivery.md) |

The important boundaries are English UI, procedural and externally sourced visual
assets with an explicit personal-GLB import boundary, browser-local persistence, and explicit separation of draft from
published state. Real HA credentials and household mappings belong to the browser
runtime, not generated home code. Browser editing is an implemented feature.

Private deployment hardening, complete household runtime acceptance, and final
cross-browser/accessibility acceptance must not be represented as complete merely
because the app builds or fixture tests pass.
