# In-browser demo adapter

`DemoHomeAssistantSession` supplies the existing HA runtime value and binding
profile to normal dashboard components. All simulation is private to this folder;
the original engine entry point remains a compatibility facade.

Input is a `HomeManifest`, including its existing typed slots. No special room
names, household IDs, HA backend, or mock configuration is needed. Add supported
devices to the home and the adapter derives synthetic room/entity relationships.
Changing the manifest or remounting the provider resets the memory-only state.

| Slot domain         | Behavior                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| light               | On/off, brightness, RGB service data; normal dashboard controls remain unchanged                      |
| switch              | On/off                                                                                                |
| fan                 | Starts on at 50% speed; on/off and percentage controls update in memory                               |
| valve               | Starts open; open, close and position controls update in memory                                       |
| cover               | Open, close, position; moves immediately, with no pretend motor timer                                 |
| climate             | Target temperature, heat/cool/off; current temperature stays fixed                                    |
| sensor              | Fixed temperature, humidity, battery, illuminance, power, energy, CO₂, pressure based on device class |
| lock                | Lock/unlock in memory                                                                                 |
| alarm_control_panel | Arm home/away and disarm without a code                                                               |
| binary_sensor       | Fixed closed/off or occupied/connected state based on device class                                    |
| media_player        | Starts playing the demo playlist; power, play/pause and volume controls update in memory              |

Classless status sensors start idle; unknown sensor classes show unknown; unsupported domains remain unmapped. The
adapter prefers fan and valve domains over a switch fallback, so sprinklers use
their valve controls. Active states drive the existing catalog animations and
respect reduced motion.
The
adapter does not simulate cameras, history, discovery protocols, physical thermal
behavior, audio output, or HA authentication. Integration acceptance still needs real HA.

The definition module derives IDs and initial bindings, including outdoor devices without a room or area. The state module contains
pure service validation and immutable updates. The provider owns React state and
an optional `onInteraction` callback for onboarding. Batch calls validate all
targets before applying any changes, and disposed sessions reject commands.

No transport, credentials, persistence, global singleton, or imports from `home/`.
The only runtime value imported from `HomeAssistantRuntime` is its context value
provider; the real client and hook are forbidden by the import check. Add future
simulation behavior here, never as `isDemo` branches in controls or models.

Fan power and valve open/close commands also update only in memory.

Event profiles use a fixed synthetic last-event timestamp and `short_release` type, with no commands.
