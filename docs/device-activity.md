# Device activity inventory

Every stable device preset has one visual strategy. This inventory describes physical
activity, not merely connectivity. The existing resolved visual state remains the
source of truth; these effects do not infer cycles from numeric sensor values.

| Strategy                                               | Preset IDs                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Animated picture                                       | `television`, `compact-wall-television`, `wall-television`                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Tumbling laundry                                       | `washing-machine`, `tumble-dryer`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Rising steam                                           | `coffee-maker`, `electric-kettle`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Warm interior window                                   | `oven`, `built-in-microwave`, `microwave`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Shared activity hologram                               | `water-heater`, `dishwasher`, `smart-plug`, `smart-power-strip`, `pet-feeder`, `robot-vacuum`, `humidifier-dehumidifier`, `air-purifier`, `heated-towel-rail`, `smart-panel-radiator`, `bathroom-extractor-fan`                                                                                                                                                                                                                                                                          |
| Existing airflow / rotation / spray                    | `indoor-ac`, `ceiling-fan`, `table-fan`, `pedestal-fan`, `pop-up-sprinkler`, `rotating-sprinkler`                                                                                                                                                                                                                                                                                                                                                                                        |
| Existing light emission                                | `floor-lamp`, `rattan-bell-pendant`, `terracotta-pendant`, `white-dome-pendant`, `under-cabinet-led-strip`, `low-garden-lantern`, `pergola-string-lights`, `garden-lantern-pole`, `table-lamp`, `woven-pendant`, `children-pendant`, `ceiling-light`, `recessed-downlight`, `wall-sconce`, `illuminated-round-mirror`, `round-globe-wall-lamp`, `wall-reading-spot`, `oak-wall-uplight`, `six-globe-ceiling-lamp`, `astro-parallel-wall-light`, `tubular-wall-lamp`, `clip-reading-lamp` |
| Existing position / sound feedback                     | `motorized-blind`, `integrated-roller-shutter`, `motorized-curtain`, `wall-switch`, `motorized-valve`, `smart-lock`, `smart-button`, `speaker`                                                                                                                                                                                                                                                                                                                                           |
| Existing live media / display                          | `camera-screen`, `connected-frame-oak`, `connected-frame-black`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Status / reading only (no continuous activity implied) | `smart-hose-timer`, `opening-contact`, `thermometer`, `motion-sensor`, `leak-sensor`, `smart-thermostat`, `video-doorbell`, `indoor-security-camera`, `smoke-alarm`, `carbon-monoxide-alarm`, `humidity-sensor`, `air-quality-monitor`, `energy-monitor`, `refrigerator`, `alarm-keypad`, `soil-moisture-sensor`, `siren`, `freezer`, `weather-station`, `compact-car`, `electric-sedan`, `pickup-truck`                                                                                 |

The hologram is a mint power glyph inside a translucent, camera-facing disc. It
floats by 2.5 cm, remains depth-tested, and never becomes a picking or collision
surface. Small controls use a smaller version. The water heater's old pulsing
bolt is replaced; its physical display retains the four-state status beacon.

TVs display a comic-book Superman flight with a fluttering red cape and drifting clouds; live camera surfaces take precedence.
Washer and dryer doors show tumbling fabric. Coffee makers and kettles emit stylized
steam. Oven and microwave windows turn warm while active; their interior lamps
stay steady rather than flickering. Existing lighting, covers, fans, sprinklers
and speaker feedback are preserved. Sensors, cameras, cold storage and parked
vehicles do not acquire a misleading “running” loop.

Reduced motion preserves a static active illustration or hologram. Off,
unavailable and disconnected devices omit activity effects. No additional lights,
image textures, media fetches, or dependencies are used.

Local review: run `npm run fixture:preview:connected`, then open
`http://127.0.0.1:4174/tests/device-activity-harness.html`. It renders the bundled
furnished home through the normal dashboard with synthetic active switches/media
and classless status readings. No household session is read or controlled, and
no home source or browser binding profile is changed. The fixture is read-only.

Append `?studio` for the compact kitchen/laundry demonstration with all nine
featured appliances together. Both previews support normal Orbit and Walk controls.
