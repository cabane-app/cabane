# Larch Observatory performance plan

## Reproduce the interactions

Use the checked-in Larch Observatory development workspace (two floors, 13 rooms,
315 placed items) in a production build. Keep its geometry, fixtures and default
placement. Use an isolated browser workspace and deterministic device states.
Measure at desktop size and at 390 × 844 with touch and a device pixel ratio of 3.
Record the actual drawing buffer, GPU, browser and any CPU throttling. Use the
existing performance harness and the real runtime and controls.

1. Record direct Orbit motion and a touch replay with pan, pinch and rotation.
   Include room transitions as a separate replay. Measure stable day and night,
   including a dense visible set of lit fixtures.
2. Operate connected lights while moving. Capture first activation separately
   from repeated on/off and dimming. Check that the fixture and its illumination
   actually respond. Track action-to-render time and the worst gaps around each
   input as well as aggregate frame pacing.
3. Enter Walk, move and look, then repeat while firing the installed gun. Record
   entry and the first shot separately from repeated shots. Verify movement and
   the hit effect so an inactive input cannot pass the benchmark.
4. Repeat promising comparisons under a slower CPU and on Safari if available.
   Treat a physical phone as a separate result. Use issue #106's apartment and
   room replay as a secondary comparison. The reporter saw heavy drag stutters
   after average FPS improved. [Issue #106 follow-up](https://github.com/cabane-app/cabane/issues/106#issuecomment-6651772751)

Compare at least three runs on the same machine and settings for changes we keep.
Save raw frames locally. Report p50, p95, p99, maximum and the fraction above
33.3 ms, plus CPU submission, draw calls, triangles, shader variants and new
batch buffers when they explain the result. For sustained 60 Hz interaction, use
the existing target of p95 ≤20 ms, p99 ≤33.3 ms and <1% above 33.3 ms. Isolated
first-use hitches still matter if the aggregate meets those thresholds.

## Separate the costs

Run each temporary diagnostic independently on the same replay and viewpoint.
Take CPU profiles in separate runs. Compare visuals before keeping any change.

| Priority | Hypothesis                                                                    | Diagnostic and expected signal                                                                                                                                                                                                                         |
| -------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | Input or state updates cause CPU spikes or resource churn.                    | Compare direct Orbit and touch, then correlate light changes and shots with React commits, new geometry, GPU uploads and program creation. A state-only update should reuse its existing resources.                                                    |
| 2        | The renderer redraws the static sun shadow map during camera motion.          | Freeze the map after its first valid draw. Compare shadow passes, triangles and CPU time across the same daylight replay. Household point lights currently cast no native shadows.                                                                     |
| 3        | The main pass pays for inactive or distant point lights and their wall masks. | Compare the current pool with no household point lights, then isolate inactive slots and wall masking. A reduction in fragment work at the same resolution points to per-light cost. Measure the toggle cost separately to catch shader recompilation. |
| 4        | Scene-wide stylization or excessive pixel work limits the GPU.                | Isolate the contour pass and toon material separately. Lower DPR only as a control. Keep the geometry and camera fixed to distinguish pixel cost from submission cost.                                                                                 |
| 5        | Scene traversal, batching or gun-specific work scales with the whole house.   | Profile walking and firing separately, and attribute CPU work to picking, collision, effects, LOD, batching and submission. Check whether dense detail outside the view still costs CPU or draws.                                                      |

## Apply the measured changes

Start with redundant work, expensive invalidations and avoidable first-use
compilation. Preserve the scene's appearance, wall separation, responsive light
controls, and Walk and gun behavior. Reuse static visibility, geometry and
shadow information until a real change invalidates it. A cached native shadow
map is the first comparison for static casters. Investigate a baked contribution
only if it solves a measured cost and can preserve independent switches, color
and dimming for editable homes with a clear memory and invalidation budget.

Keep a change when it improves a reproduced symptom or removes measured work
without worsening another path. Run the relevant rendering and interaction
regressions and the repository checks. Record the resulting comparisons and
remaining limits in the performance log.

The supplied skills informed the split between state updates, scene submission,
pixel work and shadow invalidation. Check API details against Cabane's pinned
Three r182 and Fiber 9.7. [R3F skills](https://github.com/EnzeD/r3f-skills/blob/main/skills/r3f-lighting/SKILL.md) · [Three.js skills](https://github.com/cloudai-x/threejs-skills/blob/main/skills/threejs-performance/SKILL.md) · [Fiber performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls) · [Three r182 light loop](https://github.com/mrdoob/three.js/blob/r182/src/renderers/shaders/ShaderChunk/lights_fragment_begin.glsl.js#L66) · [Three shadow update controls](https://threejs.org/docs/pages/LightShadow.html)
