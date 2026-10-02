import test from "node:test";
import assert from "node:assert/strict";
import { trafficTimeActivity, deriveTrafficActivity, trafficEventTiming, triggerTrafficPass } from "./trafficAudio.ts";

const road = (density, motion, proximity) => ({ normalized: { density, motion, proximity } });

test("smooth local-time fallback peaks at midday and wraps at midnight", () => {
  assert.equal(trafficTimeActivity(13), 1);
  assert.equal(trafficTimeActivity(3), 0.1);
  assert.equal(trafficTimeActivity(25), trafficTimeActivity(1));
  assert.ok(Math.abs(trafficTimeActivity(23.999) - trafficTimeActivity(0.001)) < 0.001);
  for (let hour = 0; hour < 24; hour += 0.01) {
    assert.ok(trafficTimeActivity(hour) >= 0.1 && trafficTimeActivity(hour) <= 1);
    assert.ok(Math.abs(trafficTimeActivity(hour + 0.001) - trafficTimeActivity(hour)) < 0.001);
  }
});

test("live flow dominates at night; missing, invalid and unreliable roads fall back", () => {
  assert.ok(deriveTrafficActivity(3, road(1, 1, 1), true).activity > 0.85);
  assert.equal(deriveTrafficActivity(13, road(0, 0, 0), true).activity, 0.15);
  for (const candidate of [null, road(NaN, 1, 1), road(1, Infinity, 1)]) {
    assert.deepEqual(deriveTrafficActivity(13, candidate, true), { activity: 1, proximity: 0.35, live: false });
  }
  assert.equal(deriveTrafficActivity(3, road(1, 1, 1), false).activity, 0.1);
  assert.ok(deriveTrafficActivity(13, road(0, 1, 1), true).activity >
    deriveTrafficActivity(13, road(0, 0, 1), true).activity);
});

test("ecological clock is sparse with meaningful silence and no tempo input", () => {
  for (const activity of [0, 0.1, 0.5, 1]) {
    for (const random of [0, 0.5, 1]) {
      const timing = trafficEventTiming(activity, random);
      assert.ok(timing.interval >= 7 && timing.interval <= 55);
      assert.ok(timing.minimumInterval > 5);
      assert.ok(timing.probability >= 0.25 && timing.probability <= 0.9);
    }
  }
  assert.ok(trafficEventTiming(0.1, 0.5).interval > trafficEventTiming(1, 0.5).interval * 4);
});

function mockContext(stereo = true) {
  const nodes = [];
  const param = () => ({
    value: 0, calls: [],
    setValueAtTime(value, time) { this.calls.push(["set", value, time]); },
    linearRampToValueAtTime(value, time) { this.calls.push(["linear", value, time]); },
    exponentialRampToValueAtTime(value, time) { this.calls.push(["exponential", value, time]); },
  });
  const node = (kind) => {
    const result = {
      kind, gain: param(), frequency: param(), Q: param(), pan: param(),
      disconnected: false, connections: [],
      connect(target) { this.connections.push(target); },
      disconnect() { this.disconnected = true; },
      start(...args) { this.started = args; },
      stop(time) { this.stopped = time; },
    };
    nodes.push(result);
    return result;
  };
  return {
    nodes,
    createBufferSource: () => node("noise"),
    createOscillator: () => node("engine"),
    createBiquadFilter: () => node("filter"),
    createGain: () => node("gain"),
    ...(stereo ? { createStereoPanner: () => node("pan") } : {}),
  };
}

test("passes approach/recede, pan, stop and disconnect all temporary nodes", () => {
  for (const stereo of [true, false]) {
    const ctx = mockContext(stereo);
    let completed = 0;
    const cancel = triggerTrafficPass(ctx, {}, { duration: 2 }, 10, 1, () => completed++);
    const sources = ctx.nodes.filter((node) => node.kind === "noise" || node.kind === "engine");
    const duration = sources[0].stopped - 10 - 0.02;
    assert.ok(duration >= 1.5 && duration <= 5);
    assert.equal(sources[0].stopped, sources[1].stopped);
    const envelope = ctx.nodes.filter((node) => node.kind === "gain").at(-1);
    assert.equal(envelope.gain.calls[0][1], 0);
    assert.ok(envelope.gain.calls[2][1] <= 0.056);
    assert.equal(envelope.gain.calls.at(-1)[1], 0);
    if (stereo) {
      const pan = ctx.nodes.find((node) => node.kind === "pan").pan.calls;
      assert.equal(pan[1][1], 0);
      assert.equal(pan[0][1], -pan[2][1]);
    }
    sources[0].onended();
    assert.equal(completed, 0);
    sources[1].onended();
    assert.equal(completed, 1);
    assert.ok(ctx.nodes.every((node) => node.disconnected));
    cancel();
    assert.equal(completed, 1);
  }
});

test("early cancellation releases every pass node exactly once", () => {
  const ctx = mockContext();
  let completed = 0;
  const cancel = triggerTrafficPass(ctx, {}, { duration: 2 }, 0, 0, () => completed++);
  cancel();
  cancel();
  assert.equal(completed, 1);
  assert.ok(ctx.nodes.every((node) => node.disconnected));
  assert.ok(ctx.nodes.filter((node) => ["noise", "engine"].includes(node.kind)).every((node) => node.stopped === undefined));
});
