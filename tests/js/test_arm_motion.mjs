import test from "node:test";
import assert from "node:assert/strict";
import {
  motionAngles,
  wrapDegrees,
  splitWrappedPath,
} from "../../math/arm_motion.mjs";

const close = (a, b) => Math.abs(wrapDegrees(a - b)) < 1e-9;

test("each motion starts and ends at the same physical configuration", () => {
  for (const pattern of ["shoulder", "elbow", "both"]) {
    for (const phase of [0, 1]) {
      const pose = motionAngles(pattern, phase, [170, -150]);
      assert.ok(close(pose[0], 170) && close(pose[1], -150));
    }
  }
});

test("single-joint sweeps hold the other joint fixed", () => {
  assert.deepEqual(motionAngles("shoulder", 0.25, [10, 45]), [90, 45]);
  assert.deepEqual(motionAngles("elbow", 0.25, [10, 45]), [10, 145]);
});

test("angle wrap preserves orientation at and beyond the display boundary", () => {
  assert.equal(wrapDegrees(181), -179);
  assert.equal(wrapDegrees(-181), 179);
  assert.ok(close(wrapDegrees(540), 180));
  for (let i = 0; i <= 100; i++) {
    for (const q of motionAngles("both", i / 100, [170, 170]))
      assert.ok(q >= -180 && q <= 180);
  }
});

test("C-space traces break at either periodic seam without losing samples", () => {
  const points = [
    [170, 0],
    [179, 0],
    [-179, 0],
    [-170, 179],
    [-170, -179],
  ];
  const segments = splitWrappedPath(points);
  assert.deepEqual(
    segments.map((s) => s.length),
    [2, 2, 1],
  );
  assert.deepEqual(segments.flat(), points);
  assert.deepEqual(splitWrappedPath([]), []);
});

test("invalid motion requests are rejected", () => {
  for (const phase of [-0.1, 1.1, NaN])
    assert.throws(() => motionAngles("both", phase, [0, 0]), RangeError);
  assert.throws(() => motionAngles("unknown", 0, [0, 0]), RangeError);
});
