# Third-party notices

The browser floor-layout editor uses original Cabane code informed by
the following MIT-licensed projects:

## OpenPlan3D

- Project: <https://github.com/laanlabs/openPlan3D>
- License: MIT
- Referenced concepts: splitting wall graphs at T-junctions and traversing
  directed planar edges to discover bounded room faces.

Copyright remains with the OpenPlan3D contributors. The repository's source
was reviewed as a behavioral and algorithmic reference; its Svelte stores,
rendering layer, application state, and data schema were not copied.

## ai_room_planner

- Project: <https://github.com/countzero/ai_room_planner>
- License: MIT
- Referenced concepts: browser pointer interactions, left-hand planar room
  traversal, room metadata, and local draft persistence.

Copyright remains with the ai_room_planner contributors. The repository's
global-script UI, storage schema, and rendering implementation were not
copied.

## React Three Drei RoundedBox

The cached rounded-box primitive preserves the shape construction from
`@react-three/drei`'s RoundedBox.

MIT License

Copyright (c) 2020 react-spring

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## fflate

Personal model archives use fflate 0.8.3 for ZIP encoding and decoding.

MIT License

Copyright (c) 2026 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## noble-hashes

SHA-256 verification uses @noble/hashes 2.4.0 when SubtleCrypto is unavailable.

The MIT License (MIT)

Copyright (c) 2022 Paul Miller (https://paulmillr.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## React Three Drei Clouds

Weather uses the installed MIT-licensed `@react-three/drei` Cloud/Clouds components.
The hosted cloud sprite is the upstream default asset from
[pmndrs/drei-assets](https://github.com/pmndrs/drei-assets/blob/9225a9f1fbd449d9411125c2f419b843d0308c9f/cloud.png),
pinned to commit `9225a9f1fbd449d9411125c2f419b843d0308c9f` and served by rawcdn.githack.com.
The asset repository does not separately identify a cloud-image license; the
component's MIT license should not be read as a separate asset license claim.

## Home Assistant logo

The workspace library and import dialog use the official Home Assistant SVG mark
from [Home Assistant frontend](https://github.com/home-assistant/frontend/blob/dev/src/resources/home-assistant-logo-svg.ts)
to identify Home Assistant connections. The logo is a trademark of the Open Home
Foundation; see the [official logo guidelines](https://github.com/home-assistant/assets/tree/master/logo).

## Architectural finish scans

The bundled WebP finish maps derive from Poly Haven scans retrieved on 17–18 November 2026.
Wood and stone floors use 2K colour, displacement and roughness sources. All are licensed under [CC0 1.0](https://polyhaven.com/license).

- Jenelle van Heerden's [White Oak Veneer](https://polyhaven.com/a/white_oak_veneer) and [American Walnut Veneer](https://polyhaven.com/a/american_walnut_veneer) supply the grain for the 3.6 m plank repeats. Cabane arranges the scans into staggered 18 cm boards and grades them for the oak and walnut presets.
- Timber door joinery uses a neutral monochrome grade of the White Oak Veneer scan so each door retains its selected stain.
- [Herringbone Parquet](https://polyhaven.com/a/herringbone_parquet), photographed by Sergej Majboroda and processed by Jenelle van Heerden, supplies the 3.4 m parquet repeat.
- Rob Tuytel's [Marble 01](https://polyhaven.com/a/marble_01) supplies the mineral detail for the limestone and travertine finishes. The limestone retains the scanned 1.5 m layout. The travertine uses individual stone crops in a 60 cm square layout.
- Rob Tuytel's [White Plaster 02](https://polyhaven.com/a/white_plaster_02) supplies a neutral 1 m repeat that takes the authored wall color.
- Charlotte Baglioni's [Grass Ground](https://polyhaven.com/a/grass_ground) supplies the 2.5 m turf repeat. Cabane grades the diffuse scan to retain the home's authored ground color.
- [Wood Chips](https://polyhaven.com/a/wood_chips) by eye-candy.xyz supplies the 2 m pine bark repeat. [Gravel Floor 02](https://polyhaven.com/a/gravel_floor_02), photographed by Dimitrios Savva and processed by Jenelle van Heerden, supplies the 2 m gravel repeat. Cabane grades the diffuse and occlusion scans for the garden palette and uses reduced OpenGL normal maps for surface relief.

The architectural reflection probe is a 256 × 128 linear-light reduction of
Sergej Majboroda’s [Studio Small 09](https://polyhaven.com/a/studio_small_09),
bundled under [CC0](https://polyhaven.com/license).

## Countryside landscape

The ground and trees derive from IGN LiDAR HD ground and surface elevations,
retrieved on 18 November 2026. The 384 m and 1,536 m survey tiles share a centre at
421438 E, 6875407 N in Lambert-93. Cabane quantizes the elevations and derives
stems, canopy positions and soft ground shade. IGN BD ORTHO® informed the
vegetation mask during asset preparation.
[IGN BD ORTHO](https://www.data.gouv.fr/datasets/bd-ortho-r) ·
[IGN LiDAR HD terrain](https://www.data.gouv.fr/datasets/mnt-lidar-hd) ·
[IGN LiDAR HD surface](https://www.data.gouv.fr/datasets/mns-lidar-hd) ·
[Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/)

The leaf sprays use leaf samples from Rico Cilliers’ Shrub 04. The lawn uses blade detail and occlusion from [Grass 005](https://ambientcg.com/view?id=Grass005), published by ambientCG under [CC0](https://docs.ambientcg.com/license/). The sky textures use the celestial
portions of Kloppenheim 06 (Pure Sky) by Greg Zaal and Jarod Guest, and Rogland
Clear Night by Greg Zaal. These three Poly Haven assets were retrieved on 18 November
2026 and converted to WebP. [Shrub 04](https://polyhaven.com/a/shrub_04) ·
[Kloppenheim 06 (Pure Sky)](https://polyhaven.com/a/kloppenheim_06_puresky) ·
[Rogland Clear Night](https://polyhaven.com/a/rogland_clear_night) · [CC0](https://polyhaven.com/license)
