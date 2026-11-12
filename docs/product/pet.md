# Pet scene feature

The web host installs optional scene features through `SceneFeatureDefinition`.
The engine supplies scene-local building, floor, opening pose, visibility and reduced
motion inputs. It never imports the Pet package or an animal asset. Features are
independent from equipped Walk tools.

`@cabane/pet` exposes `createPetFeature(model)`. Its injected model descriptor owns
the self-contained GLB URL, walk/idle clip names, scale, collision clearance and
speed and authored distance per walk cycle. Models must be grounded, use metres and face +Z. No animal name is part of
the integration. Original GLB materials and animations are retained.

## Activation and loading

**Settings → Shortcuts → Add actions → Call pet** adds an optional shortcut.
It is absent from defaults. The host exposes only its label, illustrated paw icon
and lazy component loader. No Pet runtime code or model is loaded until the user
invokes the configured shortcut. Removing the shortcut unmounts Pet and releases
animation and GPU resources. Activation is local to the current home session.
Pet can coexist with the gun and works in orbit and Walk views.

The default animated model lives in `packages/pet/assets/` with its attribution.
Original photographs and source reference images are not distributed. The model
descriptor remains injected; custom model selection is not exposed yet.
The portable shortcut stores only `{kind: "scene-feature", featureId: "pet"}`,
never a model URL or implementation settings. Hosts without the installation
show an unavailable action.

In Walk, invoking Call pet attracts it toward the visitor for up to ten seconds,
including across reachable rooms. Repeating the action renews that call without
reloading the model. Normal same-room greeting and roaming then resume.

## Movement and limits

The package owns a bounded grid planner with an injected walkability predicate.
In orbit it follows reachable paths and pauses between destinations. In Walk it
approaches the user only when both occupy the same room, stopping about one metre
away and smoothly looking toward the user with bounded head rotation. When the
user leaves that room it immediately returns to autonomous roaming. Orbit cameras
do not attract the pet.
It accelerates and brakes around turns, following small arcs rather than rotating
its body at rest. In tight corners it takes turning steps without crossing an
obstacle. Only the head tracks a visitor while stationary. The walk clip playback rate follows actual
ground speed and the injected stride length, including model scale; an idle clip
takes over when stopped. It does not teleport through disconnected rooms. Walls, closed doors,
loaded furniture and upper-floor stair holes constrain routes. Changes to loaded
colliders or door poses rebuild navigation while retaining the current position.
The injected radius is a conservative clearance envelope; narrow passages may be
unreachable for a large profile. Pet stays on the active floor; stair traversal and opening doors are not supported.
A floor with no safe spawn shows no pet. Only level surfaces at the active floor’s base elevation are supported; raised
platforms and sloped transitions are excluded.

Motion pauses while the document is hidden, scene controls are blocked or reduced
motion is requested. Assets load only after activation. Load failure stays local
to the feature and shows `Pet model unavailable`; removing its shortcut still works.
The model does not intercept house selection or laser hits.

Verification: `tests/pet-roaming.test.mjs` exercises reachability and movement
constraints; `tests/scene-features.test.mjs` checks independent activation, injected
inputs and home isolation. Personal appearance evidence lives outside Git.
