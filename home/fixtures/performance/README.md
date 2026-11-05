# Performance homes

These synthetic HomeProject JSON files can be loaded into any Cabane development
workspace with the built-in catalog.

| File                                                                | Workload                                                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [Apartment](apartment.project.json)                                 | Snapshot of the `npm run perf -- --scenario apartment` scene. Twelve small rooms and 96 furnishings.                         |
| [Dense courtyard apartment](dense-courtyard-apartment.project.json) | Seventeen rooms on one active floor, including the gallery. 269 items across 122 models, 20 windows, and six floor finishes. |
| [Casa Solstice](../../showcase/furnished.project.json)              | Two floors, 239 scene items, and a mix of architecture, furnishings, and device models.                                      |

In Cabane, open **Workspaces → Import workspace → From file**, choose a JSON file,
then select **Save** in the editor to apply the imported design to the dashboard.

To keep an edited copy, use **Workspaces → Export workspace → Portable design**.
The exported `.cabane` archive can be imported directly. For a catalog-only home
you want to keep as JSON, extract `project.json` from the archive. Keep the whole
archive when the home includes imported 3D model assets.
