import assert from "node:assert/strict";
import test from "node:test";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const { DEVICE_THROTTLE_MS, DeviceCommandScheduler, VALUE_DEBOUNCE_MS } = await load(
    "/packages/engine/src/command-scheduler.ts",
  );
  const { canceledClimateRangeEdit, climateTargetTemperature, climateTemperatureRangeCall } =
    await load("/packages/engine/src/home-assistant-controls.ts");

  test("uses the Phase 3 production timing contract", () => {
    assert.equal(VALUE_DEBOUNCE_MS, 500);
    assert.equal(DEVICE_THROTTLE_MS, 2_000);
  });

  const fakeClock = () => {
    let now = 0;
    let nextId = 1;
    const timers = new Map();
    return {
      now: () => now,
      setTimer: (callback, delay) => {
        const id = nextId++;
        timers.set(id, { callback, at: now + delay });
        return id;
      },
      clearTimer: (id) => timers.delete(id),
      advance: async (milliseconds) => {
        now += milliseconds;
        while (true) {
          const due = [...timers.entries()]
            .filter(([, timer]) => timer.at <= now)
            .sort(([, left], [, right]) => left.at - right.at)[0];
          if (!due) break;
          timers.delete(due[0]);
          due[1].callback();
          await Promise.resolve();
        }
      },
    };
  };

  const brightnessCall = (value) => ({
    domain: "light",
    service: "turn_on",
    data: { brightness_pct: value },
    target: { entity_id: "light.demo" },
    delivery: { mode: "coalesced-value", channel: "brightness" },
  });

  test("coalesces channel values and throttles later values per device", async () => {
    const clock = fakeClock();
    const dispatched = [];
    const scheduler = new DeviceCommandScheduler({
      dispatch: async (call) => {
        dispatched.push(call);
      },
      resolveDeviceKey: () => "device-light",
      debounceMs: 5,
      throttleMs: 20,
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    const first = scheduler.schedule(brightnessCall(20));
    const second = scheduler.schedule(brightnessCall(80));
    await clock.advance(4);
    assert.equal(dispatched.length, 0);
    await clock.advance(1);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].data.brightness_pct, 80);
    await Promise.all([first, second]);

    const third = scheduler.schedule({
      ...brightnessCall(60),
      delivery: { mode: "coalesced-value", channel: "volume" },
    });
    await clock.advance(19);
    assert.equal(dispatched.length, 1);
    await clock.advance(1);
    assert.equal(dispatched.length, 2);
    await third;
    scheduler.dispose();
  });

  test("immediate actions cancel pending values and dispatch immediately", async () => {
    const clock = fakeClock();
    const dispatched = [];
    const scheduler = new DeviceCommandScheduler({
      dispatch: async (call) => {
        dispatched.push(call);
      },
      resolveDeviceKey: () => "device-light",
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    const pending = scheduler.schedule(brightnessCall(40));
    await scheduler.schedule({
      domain: "light",
      service: "turn_off",
      target: { entity_id: "light.demo" },
    });
    await pending;
    await clock.advance(5_000);
    assert.deepEqual(
      dispatched.map((call) => call.service),
      ["turn_off"],
    );
  });

  test("coalesces humidity, temperature, position, and number values independently", async () => {
    const clock = fakeClock();
    const dispatched = [];
    const scheduler = new DeviceCommandScheduler({
      dispatch: async (call) => {
        dispatched.push(call);
      },
      resolveDeviceKey: () => "device-multifunction",
      debounceMs: 5,
      throttleMs: 20,
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    const makeCall = (channel, value) => ({
      domain: "number",
      service: "set_value",
      data: { value },
      target: { entity_id: "number.multifunction" },
      delivery: { mode: "coalesced-value", channel },
    });
    const scheduled = [];
    for (const [channel, first, latest] of [
      ["humidity", 40, 45],
      ["temperature", 20, 21],
      ["position", 60, 70],
      ["value", 10, 15],
    ]) {
      scheduled.push(scheduler.schedule(makeCall(channel, first)));
      scheduled.push(scheduler.schedule(makeCall(channel, latest)));
    }
    await clock.advance(5);
    await clock.advance(20);
    await clock.advance(20);
    await clock.advance(20);
    await Promise.all(scheduled);
    assert.deepEqual(dispatched.map((call) => [call.delivery.channel, call.data.value]).sort(), [
      ["humidity", 45],
      ["position", 70],
      ["temperature", 21],
      ["value", 15],
    ]);
    scheduler.dispose();
  });

  test("held dimming streams the latest value at a bounded rate without waiting for release", async () => {
    const clock = fakeClock();
    const dispatched = [];
    const scheduler = new DeviceCommandScheduler({
      dispatch: async (call) => dispatched.push(call),
      resolveDeviceKey: () => "device-light",
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    const continuous = (value) => ({
      ...brightnessCall(value),
      delivery: { mode: "continuous-value", channel: "brightness" },
    });
    const scheduled = [scheduler.schedule(continuous(20))];
    await clock.advance(0);
    assert.deepEqual(
      dispatched.map((call) => call.data.brightness_pct),
      [20],
    );
    scheduled.push(scheduler.schedule(continuous(25)));
    await clock.advance(200);
    scheduled.push(scheduler.schedule(continuous(30)));
    await clock.advance(49);
    assert.equal(dispatched.length, 1);
    await clock.advance(1);
    assert.deepEqual(
      dispatched.map((call) => call.data.brightness_pct),
      [20, 30],
    );
    scheduled.push(scheduler.schedule(continuous(35)));
    await clock.advance(250);
    assert.equal(
      dispatched.at(-1).data.brightness_pct,
      35,
      "deliver the final level after release",
    );
    const cancelled = scheduler.schedule(continuous(40));
    await scheduler.schedule({
      domain: "light",
      service: "turn_off",
      target: { entity_id: "light.demo" },
    });
    await clock.advance(1000);
    await Promise.all([...scheduled, cancelled]);
    assert.equal(dispatched.at(-1).service, "turn_off", "power off cancels pending dimming");
    scheduler.dispose();
  });

  test("coalesces climate edits and resolves the untouched target from the latest snapshot", async () => {
    const clock = fakeClock();
    const entity = {
      entityId: "climate.demo",
      state: "heat",
      available: true,
      stale: false,
      attributes: {
        supported_features: 2,
        min_temp: 16,
        max_temp: 30,
        target_temp_step: 0.5,
        target_temp_low: 18,
        target_temp_high: 21,
      },
    };
    const dispatched = [];
    let reportAfterWrite = true;
    let finishFirst;
    const firstWrite = new Promise((resolve) => {
      finishFirst = resolve;
    });
    const scheduler = new DeviceCommandScheduler({
      ...clock,
      debounceMs: 5,
      throttleMs: 20,
      resolveDeviceKey: () => "climate-device",
      dispatch: (call) => {
        dispatched.push(call.data);
        if (dispatched.length === 1) return firstWrite;
        if (reportAfterWrite) {
          Object.assign(entity.attributes, call.data);
          observe();
        }
        return Promise.resolve();
      },
    });
    const observe = () => scheduler.observeEntityStates({ [entity.entityId]: entity });
    observe();
    const send = (endpoint, temperature) => {
      const range = climateTargetTemperature(entity);
      return scheduler.schedule(
        climateTemperatureRangeCall(
          entity,
          range,
          { low: range.low, high: range.high, [endpoint]: temperature },
          endpoint,
        ),
      );
    };

    const first = send("low", 18.5);
    entity.attributes.target_temp_high = 22;
    observe();
    await clock.advance(5);
    assert.deepEqual(dispatched, [{ target_temp_low: 18.5, target_temp_high: 22 }]);
    const high = send("high", 23);
    await clock.advance(20);
    assert.equal(dispatched.length, 1, "a range write waits for the preceding range write");
    finishFirst();
    await Promise.resolve();
    await clock.advance(0);
    assert.equal(dispatched.length, 1, "service success alone does not confirm the edited target");
    entity.attributes.current_temperature = 19;
    observe();
    await clock.advance(0);
    assert.equal(dispatched.length, 1, "an ambient reading does not confirm the edited target");
    entity.attributes.target_temp_low = 18.5;
    observe();
    await first;
    await clock.advance(0);
    assert.deepEqual(dispatched.at(-1), { target_temp_low: 18.5, target_temp_high: 23 });
    await high;

    const nextLow = send("low", 19);
    const nextHigh = send("high", 24);
    await clock.advance(20);
    assert.equal(dispatched.length, 3);
    assert.deepEqual(dispatched.at(-1), { target_temp_low: 19, target_temp_high: 24 });
    await Promise.all([nextLow, nextHigh]);

    const invalid = assert.rejects(send("low", 21), /no longer fit/);
    entity.attributes.target_temp_high = 20;
    observe();
    await clock.advance(20);
    await invalid;
    const canceled = send("low", 19.5);
    scheduler.cancelPendingValues();
    assert.equal(await canceled, canceledClimateRangeEdit);
    assert.equal(dispatched.length, 3);

    observe();
    reportAfterWrite = false;
    const unconfirmed = assert.rejects(send("low", 19.5), /did not report/);
    await clock.advance(20);
    const blocked = assert.rejects(send("high", 22), /did not report/);
    await clock.advance(10_000);
    await Promise.all([unconfirmed, blocked]);
    assert.equal(dispatched.length, 4, "a queued edit cannot undo an unconfirmed write");
    scheduler.dispose();
  });

  test("propagates dispatch failures and rejects scheduling after disposal", async () => {
    const scheduler = new DeviceCommandScheduler({
      dispatch: async () => {
        throw new Error("fixture failure");
      },
      resolveDeviceKey: () => "device-light",
    });
    await assert.rejects(
      scheduler.schedule({
        domain: "light",
        service: "turn_off",
        target: { entity_id: "light.demo" },
      }),
      /fixture failure/,
    );
    scheduler.dispose();
    await assert.rejects(
      scheduler.schedule({
        domain: "light",
        service: "turn_on",
        target: { entity_id: "light.demo" },
      }),
      /stopped/,
    );
  });
});
