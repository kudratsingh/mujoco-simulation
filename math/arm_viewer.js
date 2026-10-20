import { motionAngles } from "/arm_motion.mjs";
import {
  drawArm,
  drawCspace,
  drawHistory,
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
const angles = () => [Number($("q1").value), Number($("q2").value)];

function draw() {
  if (!current) return;
  drawArm($("plot"), current, options, samples, camera);
  drawCspace($("cspace"), current, samples);
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
  for (let i = 0; i < 2; i++) $(`q${i + 1}`).value = q[i].toFixed(1);
}
function setProgress() {
  $("progress").value = (phase * 100).toFixed(1);
  $("progress-value").textContent = `${Math.round(phase * 100)}%`;
}
function pauseMotion(status = "Paused") {
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
  $(name).addEventListener("change", () => {
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
    update();
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
for (const [button, view] of [
  ["view3d", "3d"],
  ["view2d", "plan"],
])
  $(button).addEventListener("click", () => {
    options.view = view;
    $("plot").dataset.view = view;
    $("view3d").setAttribute("aria-pressed", String(view === "3d"));
    $("view2d").setAttribute("aria-pressed", String(view === "plan"));
    $("scene-caption").textContent =
      view === "3d"
        ? "Drag to orbit · scroll to zoom"
        : "Angles in the world xy plane · distances in metres";
    $("camera-reset").hidden = view !== "3d";
    draw();
  });
$("camera-reset").addEventListener("click", () => {
  Object.assign(camera, {
    yaw: -Math.PI / 4,
    pitch: Math.PI * 0.29,
    zoom: 1.2,
  });
  draw();
});
$("clear-trail").addEventListener("click", clearHistory);
$("retry").addEventListener("click", update);
let orbit = null;
$("plot").addEventListener("pointerdown", (e) => {
  if (options.view !== "3d" || e.button !== 0) return;
  e.preventDefault();
  orbit = [e.clientX, e.clientY, camera.yaw, camera.pitch];
  $("plot").setPointerCapture(e.pointerId);
});
$("plot").addEventListener("pointermove", (e) => {
  if (!orbit) return;
  camera.yaw = orbit[2] - (e.clientX - orbit[0]) * 0.009;
  camera.pitch = Math.max(
    0.3,
    Math.min(1.4, orbit[3] + (e.clientY - orbit[1]) * 0.008),
  );
  draw();
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  $("plot").addEventListener(event, () => (orbit = null));
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
  if (document.hidden && playing) pauseMotion();
});
update();
