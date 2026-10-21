import {
  motionAngles,
  targetFromPlanPoint,
  selectIKSolution,
  jointVelocity,
} from "/arm_motion.mjs";
import {
  drawArm,
  drawCspace,
  drawHistory,
  drawVelocity,
  drawControlHistory,
  cspaceGeometry,
} from "/arm_scene.js";
const $ = (id) => document.getElementById(id);
const fixed = (v, n = 3) => (Math.abs(v) < 0.5 * 10 ** -n ? 0 : v).toFixed(n);
const pair = (p) => `(${fixed(p[0])}, ${fixed(p[1])})`;
const camera = { yaw: -Math.PI / 4, pitch: Math.PI * 0.29, zoom: 1.2 };
const options = {
  view: "3d",
  workspace: true,
  frames: true,
  angles: true,
  trail: true,
  alternate: true,
};
let current = null,
  samples = [],
  origin = performance.now(),
  version = 0,
  pending = null,
  busy = false;
let playing = false,
  phase = 0,
  motionBase = [30, 60],
  lastTick = 0,
  lastSent = 0,
  animation = 0;
let mode = "fk",
  ikResult = null,
  preferredBranch = "elbow-up";
const controller = {
  running: false,
  runVersion: 0,
  inFlight: false,
  timer: null,
  feedback: null,
  time: 0,
  history: [],
  initial: [30, 60],
  limit: false,
};
const angles = () => [Number($("q1").value), Number($("q2").value)];

function draw() {
  if (!current) return;
  for (const name of ["workspace", "frames", "angles", "trail", "alternate"])
    options[name] = $("show-" + name).checked;
  const rates =
    mode === "control" && controller.feedback
      ? controller.feedback.joint_rates
      : [Number($("dq1").value), Number($("dq2").value)];
  const velocity = jointVelocity(current.differential.jacobian, rates);
  options.velocity = $("show-velocity").checked ? velocity : null;
  options.requestedVelocity =
    mode === "control" ? controller.feedback?.requested_velocity : null;
  updateDifferential(current.differential, velocity, rates);
  drawControlHistory($("control-history"), controller.history);
  renderControl();
  drawVelocity(
    $("velocity-plot"),
    current.differential,
    velocity,
    options.requestedVelocity,
  );
  drawArm(
    $("plot"),
    current,
    options,
    samples,
    camera,
    mode === "ik"
      ? ikResult
      : mode === "control" && controller.feedback
        ? {
            target: controller.feedback.target,
            reachable: controller.feedback.reachable,
            solutions: [],
          }
        : null,
  );
  drawCspace($("cspace"), current, samples, mode === "ik" ? ikResult : null);
  drawHistory($("history"), current, samples);
}
function clearHistory() {
  samples = [];
  origin = performance.now();
  if (current)
    samples.push({
      time: 0,
      position: current.positions[2],
      angles: current.angles_deg,
    });
  draw();
  $("sample-count").textContent =
    "History cleared. Move a joint or play a motion.";
}
function setAngles(q) {
  for (let i = 0; i < 2; i++) $(`q${i + 1}`).value = String(q[i]);
}
function setProgress() {
  $("progress").value = (phase * 100).toFixed(1);
  $("progress-value").textContent = `${Math.round(phase * 100)}%`;
}
function pauseMotion(status = "Paused") {
  pauseControl();
  playing = false;
  cancelAnimationFrame(animation);
  $("play").textContent = "Play motion";
  $("motion-status").textContent = status;
  lastTick = 0;
}
function manualChange() {
  pauseMotion();
  phase = 0;
  setProgress();
  motionBase = angles();
  update();
}
function updateLabels(p) {
  for (let i = 0; i < 2; i++) {
    const name = `q${i + 1}`;
    $(name).value = String(p.angles_deg[i]);
    $(name + "-value").textContent = `${fixed(p.angles_deg[i], 1)}°`;
    if (document.activeElement !== $(name + "-number"))
      $(name + "-number").value = fixed(p.angles_deg[i], 1);
    $(name + "-radians").textContent = `${fixed(p.angles_rad[i])} rad`;
  }
  $("hand-position").textContent = pair(p.positions[2]);
  $("elbow-position").textContent = pair(p.positions[1]);
  $("heading").textContent = `${fixed(p.hand_heading_deg, 1)}°`;
  $("reach").textContent =
    `${fixed(p.workspace_radii[0], 2)}–${fixed(p.workspace_radii[1], 2)} m`;
  for (let i = 0; i < 2; i++)
    $("legend-l" + (i + 1)).textContent = `${fixed(p.lengths[i], 2)} m`;
  const [q1, q2] = p.angles_deg,
    [x, y] = p.positions[2],
    [l1, l2] = p.lengths;
  $("x-equation").textContent =
    `${fixed(l1, 2)} cos(${fixed(q1, 1)}°) + ${fixed(l2, 2)} cos(${fixed(q1 + q2, 1)}°) = ${fixed(x)} m`;
  $("y-equation").textContent =
    `${fixed(l1, 2)} sin(${fixed(q1, 1)}°) + ${fixed(l2, 2)} sin(${fixed(q1 + q2, 1)}°) = ${fixed(y)} m`;
  [...p.chain, p.transform].forEach(
    (m, i) =>
      ($(i === 3 ? "matrix-result" : `matrix-${i}`).textContent = m
        .map((row) => row.map((v) => fixed(v, 2).padStart(5)).join(" "))
        .join("\n")),
  );
  document
    .querySelectorAll("[data-pose]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.pose === `${q1},${q2}`)),
    );
}
async function update() {
  const request = ++version;
  if (pending) pending.abort();
  pending = new AbortController();
  busy = true;
  const [q1, q2] = angles(),
    params = new URLSearchParams({
      q1,
      q2,
      l1: $("l1").value,
      l2: $("l2").value,
    });
  try {
    const response = await fetch(`/api/pose?${params}`, {
      signal: pending.signal,
    });
    if (!response.ok) throw new Error("Pose unavailable");
    const p = await response.json();
    if (request !== version) return;
    applyPose(p);
    return true;
  } catch (error) {
    if (error.name !== "AbortError" && request === version) {
      pauseMotion("Connection lost");
      $("connection-error").hidden = false;
    }
  } finally {
    if (request === version) busy = false;
  }
}
function tick(now) {
  if (!playing) return;
  if (lastTick) phase += ((now - lastTick) / 8000) * Number($("speed").value);
  lastTick = now;
  if (phase >= 1) {
    if ($("loop").checked) phase %= 1;
    else {
      phase = 1;
      setAngles(motionAngles($("pattern").value, phase, motionBase));
      setProgress();
      pauseMotion("Cycle complete");
      update();
      return;
    }
  }
  setProgress();
  if (now - lastSent >= 60 && !busy) {
    lastSent = now;
    setAngles(motionAngles($("pattern").value, phase, motionBase));
    update();
  }
  animation = requestAnimationFrame(tick);
}
$("play").addEventListener("click", () => {
  if (playing) {
    pauseMotion();
    return;
  }
  if (phase >= 1) phase = 0;
  if (phase === 0) motionBase = angles();
  playing = true;
  lastTick = 0;
  $("play").textContent = "Pause motion";
  $("motion-status").textContent = "Playing";
  animation = requestAnimationFrame(tick);
});
for (const name of ["q1", "q2"]) {
  $(name).addEventListener("input", manualChange);
  const field = $(name + "-number");
  field.addEventListener("focus", () => pauseMotion());
  field.addEventListener("change", () => {
    if (!field.checkValidity() || !Number.isFinite(field.valueAsNumber)) {
      field.reportValidity();
      field.value = $(name).value;
      return;
    }
    $(name).value = field.value;
    manualChange();
  });
}
for (const name of ["l1", "l2"]) {
  $(name).addEventListener("focus", () => pauseMotion());
  $(name).addEventListener("change", async () => {
    const field = $(name);
    if (!field.checkValidity() || !Number.isFinite(field.valueAsNumber)) {
      field.reportValidity();
      field.value = current?.lengths[name === "l1" ? 0 : 1] ?? 1;
      return;
    }
    pauseMotion();
    phase = 0;
    setProgress();
    motionBase = angles();
    samples = [];
    origin = performance.now();
    ikResult = null;
    controller.feedback = null;
    const updated = await update();
    if (updated && mode !== "fk") solveTarget();
  });
}
$("pattern").addEventListener("change", () => {
  pauseMotion();
  motionBase = angles();
  phase = 0;
  setProgress();
});
$("progress").addEventListener("input", () => {
  pauseMotion();
  phase = Number($("progress").value) / 100;
  setAngles(motionAngles($("pattern").value, phase, motionBase));
  setProgress();
  update();
});
for (const b of document.querySelectorAll("[data-pose]"))
  b.addEventListener("click", () => {
    pauseMotion();
    setAngles(b.dataset.pose.split(",").map(Number));
    phase = 0;
    setProgress();
    motionBase = angles();
    samples = [];
    origin = performance.now();
    update();
  });
for (const name of ["workspace", "frames", "angles", "trail"])
  $("show-" + name).addEventListener("change", () => {
    options[name] = $("show-" + name).checked;
    draw();
  });
function setView(view) {
  options.view = view;
  $("plot").dataset.view = view;
  $("view3d").setAttribute("aria-pressed", String(view === "3d"));
  $("view2d").setAttribute("aria-pressed", String(view === "plan"));
  $("scene-caption").textContent =
    view === "3d"
      ? "Drag to orbit · scroll to zoom"
      : mode !== "fk"
        ? "Click or drag to place the hand target · metres"
        : "Angles in the world xy plane · distances in metres";
  $("camera-reset").hidden = view !== "3d";
  draw();
}
$("view3d").addEventListener("click", () => setView("3d"));
$("view2d").addEventListener("click", () => setView("plan"));
$("camera-reset").addEventListener("click", () => {
  Object.assign(camera, {
    yaw: -Math.PI / 4,
    pitch: Math.PI * 0.29,
    zoom: 1.2,
  });
  draw();
});
$("clear-trail").addEventListener("click", clearHistory);
$("retry").addEventListener("click", () =>
  mode !== "fk" ? solveTarget() : update(),
);
let orbit = null,
  targeting = false;
function pickTarget(e) {
  const svg = $("plot"),
    rect = svg.getBoundingClientRect();
  const [x, y] = targetFromPlanPoint(
    e.clientX - rect.left,
    e.clientY - rect.top,
    svg.clientWidth,
    svg.clientHeight,
    current.workspace_radii[1],
  );
  $("target-x").value = x;
  $("target-y").value = y;
  solveTarget();
}
$("plot").addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  if (mode !== "fk" && options.view === "plan" && current) {
    e.preventDefault();
    targeting = true;
    $("plot").setPointerCapture(e.pointerId);
    pickTarget(e);
    return;
  }
  if (options.view !== "3d") return;
  e.preventDefault();
  orbit = [e.clientX, e.clientY, camera.yaw, camera.pitch];
  $("plot").setPointerCapture(e.pointerId);
});
$("plot").addEventListener("pointermove", (e) => {
  if (targeting) {
    pickTarget(e);
    return;
  }
  if (!orbit) return;
  camera.yaw = orbit[2] - (e.clientX - orbit[0]) * 0.009;
  camera.pitch = Math.max(
    0.3,
    Math.min(1.4, orbit[3] + (e.clientY - orbit[1]) * 0.008),
  );
  draw();
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  $("plot").addEventListener(event, () => {
    orbit = null;
    targeting = false;
  });
$("plot").addEventListener(
  "wheel",
  (e) => {
    if (options.view !== "3d") return;
    e.preventDefault();
    camera.zoom = Math.max(
      0.65,
      Math.min(1.45, camera.zoom * Math.exp(-e.deltaY * 0.001)),
    );
    draw();
  },
  { passive: false },
);
let choosing = false;
function pickConfiguration(e) {
  if (mode !== "fk") setMode("fk");
  const svg = $("cspace"),
    rect = svg.getBoundingClientRect(),
    g = cspaceGeometry(svg);
  const clamp = (v) => Math.max(-180, Math.min(180, v));
  setAngles([
    clamp(((e.clientX - rect.left - g.left) / (g.right - g.left)) * 360 - 180),
    clamp(((g.bottom - e.clientY + rect.top) / (g.bottom - g.top)) * 360 - 180),
  ]);
  manualChange();
}
$("cspace").addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  choosing = true;
  $("cspace").setPointerCapture(e.pointerId);
  pickConfiguration(e);
});
$("cspace").addEventListener("pointermove", (e) => {
  if (choosing) pickConfiguration(e);
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  $("cspace").addEventListener(event, () => (choosing = false));
new ResizeObserver(draw).observe($("plot"));
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseMotion();
});
update();

function applyPose(p) {
  current = p;
  updateLabels(p);
  samples.push({
    time: (performance.now() - origin) / 1000,
    position: p.positions[2],
    angles: p.angles_deg,
  });
  if (samples.length > 600) samples.shift();
  draw();
  $("sample-count").textContent =
    `${samples.length} sampled poses · current x ${fixed(p.positions[2][0])}, y ${fixed(p.positions[2][1])} m`;
  $("connection-error").hidden = true;
}
function cancelRequest() {
  ++version;
  pending?.abort();
  busy = false;
}
function setMode(next) {
  cancelRequest();
  pauseMotion();
  mode = next;
  const inverse = mode === "ik",
    tracking = mode === "control";
  $("mode-control").setAttribute("aria-pressed", String(tracking));
  $("analytic-controls").hidden = !inverse;
  $("control-buttons").hidden = !tracking;
  $("preview-rates").disabled = tracking;
  $("target-error-label").textContent = tracking
    ? "Distance to target"
    : "FK position error";
  $("velocity-explanation").textContent = tracking
    ? "Controller joint rates and requested/achieved velocity at the displayed pose."
    : "Preview instantaneous velocity at the current pose. These rates do not move the arm.";
  controller.feedback = null;
  for (const id of ["target-x", "target-y"]) {
    if (tracking) {
      $(id).min = -5;
      $(id).max = 5;
    } else {
      $(id).removeAttribute("min");
      $(id).removeAttribute("max");
    }
  }
  if (tracking) {
    controller.initial = angles();
    resetControlHistory();
  }
  $("mode-fk").setAttribute("aria-pressed", String(mode === "fk"));
  $("mode-ik").setAttribute("aria-pressed", String(inverse));
  $("ik-controls").hidden = mode === "fk";
  $("joint-controls").disabled = mode !== "fk";
  $("fk-presets").hidden = mode !== "fk";
  $("motion-controls").hidden = mode !== "fk";
  $("plot").dataset.control = mode;
  $("mode-label").textContent = tracking
    ? "Closed-loop control / Target → joint rates → motion"
    : inverse
      ? "Inverse kinematics / Target → joint angles"
      : "Forward kinematics / Angles → hand pose";
  phase = 0;
  setProgress();
  motionBase = angles();
  samples = [];
  origin = performance.now();
  if (mode !== "fk") {
    setView("plan");
    solveTarget();
  } else {
    ikResult = null;
    setView(options.view);
    update();
  }
}
function applySolution(solution) {
  ikResult.selectedBranch = solution.branch;
  // Preserve the solver's precision. Display rounding never feeds back into FK.
  solution.pose.angles_deg.forEach((q, i) => {
    $(`q${i + 1}`).value = String(q);
  });
  samples = [];
  origin = performance.now();
  applyPose(solution.pose);
  $("ik-error").textContent = solution.error.toExponential(2) + " m";
  renderIKControls();
}
function renderIKControls() {
  const r = ikResult;
  for (const branch of ["up", "down"]) {
    const solution = r?.solutions.find((s) => s.branch === `elbow-${branch}`);
    $("branch-" + branch).disabled = !solution;
    $("branch-" + branch).setAttribute(
      "aria-pressed",
      String(!!solution && solution.branch === r.selectedBranch),
    );
    $("branch-" + branch + "-angles").textContent = solution
      ? solution.pose.angles_deg.map((q) => fixed(q, 1) + "°").join(" / ")
      : "—";
  }
  if (!r) return;
  $("ik-status").dataset.state = !r.reachable
    ? "unreachable"
    : r.singular
      ? "singular"
      : "reachable";
  $("ik-status").textContent = !r.reachable
    ? "Unreachable target"
    : r.infinite
      ? "Infinitely many solutions"
      : r.singular
        ? "One configuration · reach boundary"
        : "Two solutions · same hand position";
  $("ik-message").textContent = !r.reachable
    ? (r.reason === "inside_hole"
        ? "Target is inside the central hole."
        : "Target is beyond the outer reach.") +
      " The arm keeps its last configuration."
    : r.infinite
      ? "Equal links folded at the base: every shoulder angle works. Showing the current shoulder angle."
      : r.singular
        ? "The two elbow branches merge here. The joint-angle readouts show the solution."
        : "Switch elbow branches. The hand stays at the target; its heading can change.";
  $("ik-branch-note").textContent = r.infinite
    ? "The representative keeps the previous shoulder angle; q₂ = −180°."
    : "Up/down are the left/right sides of the directed base-to-target line, not screen height.";
}
async function solveTarget() {
  if (mode === "control") {
    refreshControl();
    return;
  }
  for (const id of ["target-x", "target-y"]) {
    if (!$(id).checkValidity() || !Number.isFinite($(id).valueAsNumber)) {
      $(id).reportValidity();
      return;
    }
  }
  const request = ++version;
  pending?.abort();
  pending = new AbortController();
  busy = true;
  ikResult = null;
  renderIKControls();
  $("ik-status").dataset.state = "pending";
  $("ik-status").textContent = "Solving target…";
  $("ik-error").textContent = "—";
  const params = new URLSearchParams({
    x: $("target-x").value,
    y: $("target-y").value,
    l1: $("l1").value,
    l2: $("l2").value,
    shoulder_hint: angles()[0],
  });
  try {
    const response = await fetch(`/api/ik?${params}`, {
      signal: pending.signal,
    });
    if (!response.ok) throw new Error("IK unavailable");
    const result = await response.json();
    if (request !== version || mode !== "ik") return;
    ikResult = result;
    const solution = selectIKSolution(result, preferredBranch);
    if (solution) applySolution(solution);
    else {
      // If a target edit overtook a geometry refresh, keep the last joint
      // configuration but rebuild its FK pose with the selected link lengths.
      if (
        current &&
        result.lengths.some((length, i) => length !== current.lengths[i])
      ) {
        const [q1, q2] = angles();
        const fallback = await fetch(
          `/api/pose?${new URLSearchParams({ q1, q2, l1: result.lengths[0], l2: result.lengths[1] })}`,
          { signal: pending.signal },
        );
        if (!fallback.ok) throw new Error("Pose unavailable");
        const pose = await fallback.json();
        if (request !== version || mode !== "ik") return;
        samples = [];
        origin = performance.now();
        applyPose(pose);
      }
      renderIKControls();
      draw();
    }
    $("connection-error").hidden = true;
  } catch (error) {
    if (request === version && error.name !== "AbortError") {
      $("connection-error").hidden = false;
      $("ik-status").textContent = "Target unavailable · retry connection";
    }
  } finally {
    if (request === version) busy = false;
  }
}
$("mode-fk").addEventListener("click", () => setMode("fk"));
$("mode-ik").addEventListener("click", () => setMode("ik"));
for (const id of ["target-x", "target-y"])
  $(id).addEventListener("change", solveTarget);
for (const branch of ["up", "down"])
  $("branch-" + branch).addEventListener("click", () => {
    preferredBranch = `elbow-${branch}`;
    const solution = selectIKSolution(ikResult, preferredBranch);
    if (solution) applySolution(solution);
  });
for (const button of document.querySelectorAll("[data-target]"))
  button.addEventListener("click", () => {
    const l1 = Number($("l1").value),
      l2 = Number($("l2").value);
    const q =
      button.dataset.target === "origin"
        ? [0, 0]
        : button.dataset.target === "beyond"
          ? [l1 + l2 + 0.25, 0]
          : [l1, l2];
    [$("target-x"), $("target-y")].forEach((field, i) => {
      field.value = q[i];
    });
    solveTarget();
  });
$("show-alternate").addEventListener("change", () => {
  options.alternate = $("show-alternate").checked;
  draw();
});

function updateDifferential(d, velocity, rates) {
  rates.forEach((q, i) => {
    if (mode === "control") $("dq" + (i + 1)).value = String(q);
    $("dq" + (i + 1) + "-value").textContent = fixed(q, 2) + " rad/s";
  });
  $("velocity-result").textContent =
    `v = ${pair(velocity.total)} m/s · speed ${fixed(velocity.speed)} m/s`;
  $("jacobian-matrix").textContent = d.jacobian
    .map((row) => row.map((v) => fixed(v, 3).padStart(7)).join(" "))
    .join("\n");
  $("jacobian-det").textContent = fixed(d.determinant, 4);
  $("jacobian-sigma").textContent = d.singular_values
    .map((v) => fixed(v, 4))
    .join(" / ");
  $("jacobian-condition").textContent =
    d.condition === null
      ? "∞"
      : d.condition > 1e5
        ? d.condition.toExponential(2)
        : fixed(d.condition, 2);
  $("jacobian-manipulability").textContent = d.manipulability.toExponential(2);
  $("joint-speed-norm").textContent = fixed(velocity.rateNorm, 2) + " rad/s";
  const near = !d.singular && d.condition > 30;
  $("jacobian-status").dataset.state =
    d.singular || near ? "singular" : "reachable";
  $("jacobian-status").textContent = d.singular
    ? "Singular · only one velocity direction"
    : near
      ? "Near singular · thin velocity ellipse"
      : "Full rank · two velocity directions";
  $("jacobian-explanation").textContent = d.singular
    ? "The Jacobian has rank 1. Some instantaneous hand directions are unavailable, even though both joints can still rotate."
    : near
      ? "Both directions remain available, but one produces very little hand speed for the same combined joint speed."
      : "The two Jacobian columns span the plane. Change a joint angle and watch the available velocity directions change.";
}
for (const id of ["dq1", "dq2"])
  $(id).addEventListener("input", () => {
    pauseMotion();
    draw();
  });
$("show-velocity").addEventListener("change", draw);
for (const button of document.querySelectorAll("[data-rate]"))
  button.addEventListener("click", () => {
    pauseMotion();
    button.dataset.rate.split(",").forEach((q, i) => {
      $("dq" + (i + 1)).value = q;
    });
    draw();
  });
for (const button of document.querySelectorAll("[data-jacobian-pose]"))
  button.addEventListener("click", () => {
    if (mode !== "fk") setMode("fk");
    setAngles(button.dataset.jacobianPose.split(",").map(Number));
    samples = [];
    origin = performance.now();
    manualChange();
  });
new ResizeObserver(draw).observe($("velocity-plot"));

function pauseControl() {
  ++controller.runVersion;
  controller.running = false;
  clearTimeout(controller.timer);
  if (controller.inFlight) {
    cancelRequest();
    controller.inFlight = false;
  }
  $("control-run").textContent = "Run controller";
  renderControl();
}
function resetControlHistory() {
  controller.time = 0;
  controller.history = [];
  controller.limit = false;
}
function validTarget() {
  for (const id of ["target-x", "target-y"]) {
    if (!$(id).checkValidity() || !Number.isFinite($(id).valueAsNumber)) {
      $(id).reportValidity();
      return false;
    }
  }
  return true;
}
function refreshControl() {
  pauseMotion();
  if (!validTarget()) {
    controller.feedback = null;
    renderControl();
    $("ik-error").textContent = "—";
    $("ik-status").textContent = "Enter valid target coordinates (−5 to 5 m)";
    return;
  }
  resetControlHistory();
  controller.feedback = null;
  controlStep(0);
}
async function controlStep(dt) {
  if (mode !== "control" || !validTarget()) return false;
  const request = ++version;
  pending?.abort();
  pending = new AbortController();
  controller.inFlight = true;
  busy = true;
  const [q1, q2] = angles();
  const params = new URLSearchParams({
    q1,
    q2,
    x: $("target-x").value,
    y: $("target-y").value,
    l1: $("l1").value,
    l2: $("l2").value,
    dt,
    method: $("control-method").value,
    gain: $("control-gain").value,
    damping: $("control-damping").value,
  });
  try {
    const response = await fetch(`/api/control?${params}`, {
      signal: pending.signal,
    });
    if (!response.ok) throw new Error("Controller unavailable");
    const result = await response.json();
    if (request !== version || mode !== "control") return false;
    controller.feedback = result.command;
    if (!controller.history.length)
      controller.history.push({
        time: controller.time,
        error: result.error_before,
      });
    controller.time = Math.round((controller.time + dt) * 100) / 100;
    if (dt)
      controller.history.push({
        time: controller.time,
        error: result.command.error_norm,
      });
    if (controller.history.length > 600) controller.history.shift();
    if (result.command.status !== "tracking" || controller.time >= 15) {
      controller.running = false;
      controller.limit =
        controller.time >= 15 && result.command.status === "tracking";
    }
    applyPose(result.pose);
    return true;
  } catch (error) {
    if (request === version && error.name !== "AbortError") {
      controller.running = false;
      $("connection-error").hidden = false;
      $("ik-status").textContent = "Controller unavailable · retry connection";
    }
    return false;
  } finally {
    if (request === version) {
      busy = false;
      controller.inFlight = false;
    }
  }
}
async function controlLoop(runVersion) {
  if (!controller.running || runVersion !== controller.runVersion) return;
  const ok = await controlStep(0.04);
  if (runVersion !== controller.runVersion) return;
  if (!ok) {
    controller.running = false;
    return;
  }
  if (controller.running)
    controller.timer = setTimeout(() => controlLoop(runVersion), 40);
}
function renderControl() {
  $("control-damping-value").textContent = fixed(
    Number($("control-damping").value),
    2,
  );
  $("control-gain-value").textContent =
    fixed(Number($("control-gain").value), 2) + " /s";
  $("control-damping").disabled = $("control-method").value === "pinv";
  $("control-run").textContent = controller.running
    ? "Pause controller"
    : "Run controller";
  $("control-time").textContent = fixed(controller.time, 2) + " s";
  $("control-history-caption").textContent = controller.history.length
    ? `${controller.history.length} samples · ${fixed(controller.time, 2)} simulated seconds · 0.01 m goal tolerance`
    : "Run or step the controller to record progress.";
  const c = controller.feedback;
  for (const [id, value] of [
    ["requested", c ? pair(c.requested_velocity) : "—"],
    ["achieved", c ? pair(c.achieved_velocity) : "—"],
    ["residual", c ? fixed(c.velocity_residual) : "—"],
    ["rates", c ? pair(c.joint_rates) : "—"],
    ["limited", c ? (c.rate_limited ? "Yes" : "No") : "—"],
  ])
    $("control-" + id).textContent = value;
  $("control-raw-peak").textContent = c
    ? fixed(Math.max(...c.raw_joint_rates.map(Math.abs)), 2) + " rad/s"
    : "—";
  const canStep = !!c && c.status === "tracking" && !controller.limit;
  $("control-run").disabled = !controller.running && !canStep;
  $("control-step").disabled = !canStep;
  if (mode !== "control" || !c) return;
  const titles = {
    tracking: controller.limit
      ? "Time limit · residual error remains"
      : controller.running
        ? "Tracking target"
        : "Paused · ready to track",
    reached: "Target reached",
    stalled: "Stalled at singularity",
    unreachable: "Unreachable target",
  };
  const explanations = {
    tracking:
      "Run to reduce position error. Red arrows request hand velocity; green arrows show what the limited joint rates achieve.",
    reached:
      "The hand is within 0.01 m of the target. Joint rates are now zero.",
    stalled:
      "The target is reachable, but this local Jacobian cannot move toward it from this pose. Start from a bent configuration; damping alone cannot escape this trap.",
    unreachable:
      "The target is outside the reachable annulus. The controller holds the current configuration.",
  };
  $("ik-status").textContent = titles[c.status];
  $("ik-status").dataset.state =
    c.status === "unreachable"
      ? "unreachable"
      : c.status === "stalled" || controller.limit
        ? "singular"
        : "reachable";
  $("ik-message").textContent = controller.limit
    ? "Stopped after 15 simulated seconds. Reset or change settings to run another experiment."
    : explanations[c.status];
  $("ik-error").textContent = fixed(c.error_norm, 4) + " m";
}
$("mode-control").addEventListener("click", () => setMode("control"));
$("enable-control").addEventListener("click", () => setMode("control"));
$("control-run").addEventListener("click", () => {
  if (controller.running) {
    pauseControl();
    draw();
    return;
  }
  if (
    busy ||
    !controller.feedback ||
    controller.feedback.status !== "tracking" ||
    controller.limit
  )
    return;
  pauseMotion();
  controller.running = true;
  controlLoop(++controller.runVersion);
});
$("control-step").addEventListener("click", () => {
  pauseControl();
  if (!busy && !controller.limit) controlStep(0.04);
});
$("control-reset").addEventListener("click", () => {
  pauseControl();
  setAngles(controller.initial);
  samples = [];
  origin = performance.now();
  refreshControl();
});
for (const id of ["control-method", "control-damping", "control-gain"])
  $(id).addEventListener("change", () => {
    if (mode === "control") refreshControl();
    else draw();
  });
for (const button of document.querySelectorAll("[data-control-example]"))
  button.addEventListener("click", () => {
    const example = button.dataset.controlExample;
    const start =
      example === "trap" ? [0, 0] : example === "near" ? [0, 5] : [30, 60];
    // The midpoint radius of the reachable annulus equals the longer link.
    const l1 = Number($("l1").value),
      l2 = Number($("l2").value);
    const radius = Math.max(l1, l2);
    const target =
      example === "trap"
        ? [l1 + l2 - Math.min(l1, l2) * 0.5, 0]
        : example === "near"
          ? [radius * 0.99, radius * Math.sqrt(1 - 0.99 ** 2)]
          : [(radius * 12) / 13, (radius * 5) / 13];
    pauseMotion();
    setAngles(start);
    [$("target-x"), $("target-y")].forEach((f, i) => {
      f.value = target[i];
    });
    setMode("control");
  });
new ResizeObserver(draw).observe($("control-history"));
