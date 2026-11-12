# Pet scene feature

The web host installs optional scene features through `SceneFeatureDefinition`.
The engine supplies scene-local building, floor, opening pose, visibility and reduced
motion inputs. It never imports the Pet package or an animal asset. Features are
independent from equipped Walk tools and portable project data.

`@cabane/pet` exposes `createPetFeature(model)`. Its injected model descriptor owns
the self-contained GLB URL, walk/idle clip names, scale, collision clearance and
speed and authored distance per walk cycle. Models must be grounded, use metres and face +Z. No animal name is part of
the integration. Original GLB materials and animations are retained.

## Host configuration

Set `VITE_PET_MODEL_URL` in the web host environment to install Pet. The current
host profile uses clips `Walk_TailWag` and `Idle_TailWag`; other profiles can inject
their clip names through the factory. Without an asset URL, the optional feature
is not installed. Personal models stay outside Git. For local development:

```sh
# Copy a validated self-contained animated GLB to the ignored folder:
mkdir -p apps/web/public/personal-pets
# apps/web/.env.local
# VITE_PET_MODEL_URL=/personal-pets/pet.glb
```

In the dashboard scene menu, choose **Enable Pet**. Choose **Disable Pet** to
unmount it and release its animation and GPU resources. Activation is local to
the current home session, starts off in another home, and is not saved in portable
projects. Pet can coexist with the gun and works in orbit and Walk views.

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
to the feature and shows `Pet model unavailable`; disabling it still works.
The model does not intercept house selection or laser hits.

Verification: `tests/pet-roaming.test.mjs` exercises reachability and movement
constraints; `tests/scene-features.test.mjs` checks independent activation, injected
inputs and home isolation. Personal appearance evidence lives outside Git.
