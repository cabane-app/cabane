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

## Default Pet model

The stylized companion model was generated with Unbound Loop (Tripo Smart Mesh),
[Unbound Loop](https://loop.unbound.io/), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), as recorded for the
free-tier output on November 12, 2026. Changes include fitted skin weights,
grounding and forward-axis normalization, and custom walking and tail animations.
The fitted quadruped skeleton derives from the CC0 rig assets in
[Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app).
Source photos and reference images are not included.
