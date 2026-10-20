import { splitWrappedPath } from "/arm_motion.mjs";
const NS = "http://www.w3.org/2000/svg";
const el = (svg, tag, attrs = {}, content) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (content !== undefined) n.textContent = content;
  svg.append(n);
  return n;
};
const label = (svg, x, y, t, attrs = {}) =>
  el(svg, "text", { x, y, fill: "var(--muted)", "font-size": 11, ...attrs }, t);
const path = (svg, points, attrs = {}) =>
  el(svg, "path", {
    d: points.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" "),
    fill: "none",
    stroke: "var(--line)",
    ...attrs,
  });
const clear = (svg) => {
  svg
    .querySelectorAll(":scope > :not(title):not(desc)")
    .forEach((n) => n.remove());
  const w = svg.clientWidth,
    h = svg.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  return [w, h];
};
const hex = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const shade = (color, f) => {
  const rgb = color
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16));
  return `rgb(${rgb.map((v) => Math.round(Math.min(255, v * f))).join(",")})`;
};
const circlePoints = (center, r, z, count = 90) =>
  Array.from({ length: count + 1 }, (_, i) => {
    const a = (2 * Math.PI * i) / count;
    return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a), z];
  });

export function drawArm(svg, data, options, samples, camera) {
  const [w, h] = clear(svg);
  if (!w || !h) return;
  const radius = data.workspace_radii[1],
    extent = radius + 0.35;
  const is3d = options.view === "3d";
  const scale =
    Math.min((w - 65) / (2 * extent), (h - 65) / (2 * extent)) *
    (is3d ? camera.zoom : 1.15);
  const ox = w / 2,
    oy = is3d ? h * 0.54 : h / 2;
  const yaw = camera.yaw,
    pitch = camera.pitch;
  const right = [-Math.sin(yaw), Math.cos(yaw), 0],
    up = [
      -Math.cos(yaw) * Math.sin(pitch),
      -Math.sin(yaw) * Math.sin(pitch),
      Math.cos(pitch),
    ];
  const near = [
    Math.cos(yaw) * Math.cos(pitch),
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
  ];
  const dot = (p, v) => p.reduce((s, x, i) => s + x * v[i], 0);
  const project = (p) =>
    is3d
      ? [ox + scale * dot(p, right), oy - scale * dot(p, up)]
      : [ox + scale * p[0], oy - scale * p[1]];
  const worldLine = (a, b, attrs) => path(svg, [project(a), project(b)], attrs);
  const [base, elbow, hand] = data.positions;
  const z = is3d ? 0.34 : 0;
  const [q1, q2] = data.angles_rad;
  const reachColor = hex("--reach"),
    blue = hex("--blue"),
    orange = hex("--orange"),
    ink = hex("--ink");
  if (options.workspace) {
    const outer = circlePoints(base, radius, 0),
      inner = circlePoints(base, data.workspace_radii[0], 0).reverse();
    const outline = outer.map(project);
    const hole = inner.map(project);
    let d =
      outline.map((p, i) => `${i ? "L" : "M"}${p.join(",")}`).join(" ") + " Z";
    if (data.workspace_radii[0] > 1e-10)
      d +=
        " " +
        hole.map((p, i) => `${i ? "L" : "M"}${p.join(",")}`).join(" ") +
        " Z";
    el(svg, "path", {
      d,
      fill: reachColor,
      opacity: 0.45,
      "fill-rule": "evenodd",
    });
    path(svg, outline, { "stroke-dasharray": "4 5" });
    if (data.workspace_radii[0] > 1e-10)
      path(svg, hole, { "stroke-dasharray": "3 4" });
  }
  const tick = radius > 2 ? 1 : 0.5;
  for (
    let v = -Math.floor(radius / tick) * tick;
    v <= radius + 1e-8;
    v += tick
  ) {
    worldLine([v, -radius - 0.15, 0], [v, radius + 0.15, 0], {
      stroke: v === 0 ? "var(--line)" : "var(--grid)",
    });
    worldLine([-radius - 0.15, v, 0], [radius + 0.15, v, 0], {
      stroke: v === 0 ? "var(--line)" : "var(--grid)",
    });
    if (!is3d && v !== 0 && (w >= 440 || Number.isInteger(v))) {
      const [x, y] = project([v, 0, 0]);
      label(svg, x, y + 17, String(v), { "text-anchor": "middle" });
      const [a, b] = project([0, v, 0]);
      label(svg, a - 9, b + 4, String(v), { "text-anchor": "end" });
    }
  }
  if (options.trail && samples.length > 1)
    path(
      svg,
      samples.map((s) => project([...s.position, is3d ? 0.02 : 0])),
      { stroke: "var(--green)", "stroke-width": 2, opacity: 0.7 },
    );
  if (!is3d) {
    const p = project([hand[0], hand[1], 0]);
    const px = project([hand[0], 0, 0]),
      py = project([0, hand[1], 0]);
    path(svg, [px, p, py], {
      stroke: "var(--muted)",
      "stroke-dasharray": "3 5",
      opacity: 0.45,
    });
    worldLine([...base, 0], [...elbow, 0], {
      stroke: blue,
      "stroke-width": 13,
      "stroke-linecap": "round",
    });
    worldLine([...elbow, 0], [...hand, 0], {
      stroke: orange,
      "stroke-width": 13,
      "stroke-linecap": "round",
    });
    for (const [p, r, fill] of [
      [base, 9, ink],
      [elbow, 7, "var(--paper)"],
      [hand, 7, ink],
    ]) {
      const [cx, cy] = project([...p, 0]);
      el(svg, "circle", { cx, cy, r, fill, stroke: ink, "stroke-width": 2 });
    }
  } else {
    const faces = [];
    const addFace = (points, fill) =>
      faces.push({
        points,
        fill,
        depth: points.reduce((s, p) => s + dot(p, near), 0) / points.length,
      });
    function cylinder(center, r, low, high, color, n = 20) {
      const lower = circlePoints(center, r, low, n).slice(0, -1),
        upper = circlePoints(center, r, high, n).slice(0, -1);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        addFace(
          [lower[i], lower[j], upper[j], upper[i]],
          shade(color, 0.68 + 0.2 * Math.cos((i * 2 * Math.PI) / n - 0.8)),
        );
      }
      addFace(upper, shade(color, 1.1));
    }
    function link(a, b, color, low, high) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        length = Math.hypot(dx, dy),
        p = [(-dy / length) * 0.065, (dx / length) * 0.065];
      const corners = [
        [a[0] + p[0], a[1] + p[1]],
        [b[0] + p[0], b[1] + p[1]],
        [b[0] - p[0], b[1] - p[1]],
        [a[0] - p[0], a[1] - p[1]],
      ];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        addFace(
          [
            [...corners[i], low],
            [...corners[j], low],
            [...corners[j], high],
            [...corners[i], high],
          ],
          shade(color, i % 2 ? 0.75 : 0.87),
        );
      }
      addFace(
        corners.map((p) => [...p, high]),
        shade(color, 1.05),
      );
    }
    cylinder(base, 0.2, 0, 0.16, hex("--shadow"));
    cylinder(base, 0.105, 0.16, 0.36, ink);
    link(base, elbow, blue, 0.23, 0.31);
    link(elbow, hand, orange, 0.25, 0.33);
    cylinder(elbow, 0.1, 0.2, 0.36, blue);
    cylinder(elbow, 0.056, 0.36, 0.375, ink);
    cylinder(hand, 0.075, 0.23, 0.38, ink);
    faces
      .sort((a, b) => a.depth - b.depth)
      .forEach((face) =>
        el(svg, "polygon", {
          points: face.points.map((p) => project(p).join(",")).join(" "),
          fill: face.fill,
          stroke: face.fill,
          "stroke-width": 0.5,
          "stroke-linejoin": "round",
        }),
      );
  }
  const frameSize = Math.min(0.34, radius * 0.23);
  function axis(origin, angle, name) {
    const a = [...origin, z + 0.05],
      c = Math.cos(angle),
      s = Math.sin(angle);
    const x = [origin[0] + frameSize * c, origin[1] + frameSize * s, z + 0.05],
      y = [origin[0] - frameSize * s, origin[1] + frameSize * c, z + 0.05];
    worldLine(a, x, { stroke: "var(--red)", "stroke-width": 1.5 });
    worldLine(a, y, { stroke: "var(--green)", "stroke-width": 1.5 });
    const [x1, y1] = project(x),
      [x2, y2] = project(y);
    label(svg, x1 + 5, y1 - 4, `x${name}`, { fill: "var(--red)" });
    label(svg, x2 + 5, y2 - 4, `y${name}`, { fill: "var(--green)" });
  }
  if (options.frames) {
    axis(base, 0, "₀");
    axis(elbow, q1 + q2, "ₑ");
    axis(hand, q1 + q2, "ₕ");
  }
  if (options.angles) {
    function arc(center, start, delta, r, text) {
      const points = Array.from({ length: 41 }, (_, i) => [
        center[0] + r * Math.cos(start + (delta * i) / 40),
        center[1] + r * Math.sin(start + (delta * i) / 40),
        z + 0.07,
      ]);
      if (Math.abs(delta) > 0.02)
        path(svg, points.map(project), {
          stroke: "var(--muted)",
          "stroke-width": 1.4,
        });
      worldLine(
        [...center, z + 0.07],
        [
          center[0] + r * 1.15 * Math.cos(start),
          center[1] + r * 1.15 * Math.sin(start),
          z + 0.07,
        ],
        { stroke: "var(--muted)", "stroke-dasharray": "3 3", opacity: 0.6 },
      );
      const mid = start + (Math.abs(delta) < 0.1 ? -0.65 : delta / 2),
        p = project([
          center[0] + (r + 0.11) * Math.cos(mid),
          center[1] + (r + 0.11) * Math.sin(mid),
          z + 0.1,
        ]);
      label(svg, p[0], p[1], text, {
        fill: ink,
        "text-anchor": "middle",
        "font-size": 11,
        "paint-order": "stroke",
        stroke: "var(--paper)",
        "stroke-width": 3,
        "stroke-linejoin": "round",
      });
    }
    arc(
      base,
      0,
      q1,
      Math.min(0.3, data.lengths[0] * 0.5),
      `q₁ ${data.angles_deg[0].toFixed(0)}°`,
    );
    arc(
      elbow,
      q1,
      q2,
      Math.min(0.22, data.lengths[1] * 0.5),
      `q₂ ${data.angles_deg[1].toFixed(0)}°`,
    );
  }
  const [hx, hy] = project([...hand, z + 0.1]);
  label(svg, hx + 12, hy - 17, "Hand", {
    fill: ink,
    "font-weight": 650,
    "paint-order": "stroke",
    stroke: "var(--paper)",
    "stroke-width": 3,
  });
  if (!is3d) {
    label(svg, w - 14, oy - 10, "x (m)", { "text-anchor": "end" });
    label(svg, ox + 9, 19, "y (m)");
  }
  svg.querySelector("desc").textContent =
    `Shoulder ${data.angles_deg[0].toFixed(1)} degrees, elbow ${data.angles_deg[1].toFixed(1)} degrees; hand (${hand.map((v) => v.toFixed(3)).join(", ")}) metres. ${is3d ? "3D schematic; drag to orbit." : "Plan view."}`;
}

export function cspaceGeometry(svg) {
  const w = svg.clientWidth,
    h = svg.clientHeight;
  return { w, h, left: 44, right: w - 18, top: 14, bottom: h - 36 };
}
export function drawCspace(svg, data, samples) {
  const [w, h] = clear(svg);
  if (!w || !h) return;
  const g = cspaceGeometry(svg),
    map = (q) => [
      g.left + ((q[0] + 180) / 360) * (g.right - g.left),
      g.bottom - ((q[1] + 180) / 360) * (g.bottom - g.top),
    ];
  el(svg, "rect", {
    x: g.left,
    y: g.top,
    width: g.right - g.left,
    height: g.bottom - g.top,
    fill: "none",
    stroke: "var(--line)",
  });
  const ticks = w < 350 ? [-180, 0, 180] : [-180, -90, 0, 90, 180];
  ticks.forEach((v) => {
    const [x] = map([v, 0]),
      [, y] = map([0, v]);
    path(
      svg,
      [
        [x, g.top],
        [x, g.bottom],
      ],
      { stroke: "var(--grid)" },
    );
    path(
      svg,
      [
        [g.left, y],
        [g.right, y],
      ],
      { stroke: "var(--grid)" },
    );
    label(svg, x, g.bottom + 16, String(v), { "text-anchor": "middle" });
    label(svg, g.left - 7, y + 4, String(v), { "text-anchor": "end" });
  });
  for (const segment of splitWrappedPath(samples.map((s) => s.angles)))
    path(svg, segment.map(map), {
      stroke: "var(--blue)",
      "stroke-width": 1.8,
      opacity: 0.5,
    });
  const [x, y] = map(data.angles_deg);
  path(
    svg,
    [
      [g.left, y],
      [x, y],
      [x, g.bottom],
    ],
    { stroke: "var(--muted)", "stroke-dasharray": "3 4", opacity: 0.5 },
  );
  el(svg, "circle", {
    cx: x,
    cy: y,
    r: 5,
    fill: "var(--blue)",
    stroke: "var(--paper)",
    "stroke-width": 2,
  });
  label(svg, (g.left + g.right) / 2, h - 3, "Shoulder q₁ (°)", {
    "text-anchor": "middle",
  });
  label(svg, 12, (g.top + g.bottom) / 2, "Elbow q₂ (°)", {
    transform: `rotate(-90 12 ${(g.top + g.bottom) / 2})`,
    "text-anchor": "middle",
  });
}

export function drawHistory(svg, data, samples) {
  const [w, h] = clear(svg);
  if (!w || !h) return;
  const g = { left: 43, right: w - 18, top: 14, bottom: h - 36 };
  const end = samples.length ? Math.max(samples.at(-1).time, 15) : 15,
    start = end - 15,
    radius = data.workspace_radii[1];
  const x = (t) => g.left + ((t - start) / 15) * (g.right - g.left),
    y = (value) =>
      g.bottom - ((value + radius) / (2 * radius)) * (g.bottom - g.top);
  el(svg, "rect", {
    x: g.left,
    y: g.top,
    width: g.right - g.left,
    height: g.bottom - g.top,
    fill: "none",
    stroke: "var(--line)",
  });
  for (const value of [-radius, 0, radius]) {
    const py = y(value);
    path(
      svg,
      [
        [g.left, py],
        [g.right, py],
      ],
      { stroke: "var(--grid)" },
    );
    label(svg, g.left - 6, py + 4, value.toFixed(1), { "text-anchor": "end" });
  }
  for (let i = 0; i <= 3; i++) {
    const t = start + i * 5,
      px = x(t);
    label(svg, px, g.bottom + 16, t.toFixed(0), { "text-anchor": "middle" });
  }
  const visible = samples.filter((s) => s.time >= start && s.time <= end);
  for (const [index, color] of [
    [0, "var(--blue)"],
    [1, "var(--orange)"],
  ]) {
    const points = visible.map((s) => [x(s.time), y(s.position[index])]);
    path(svg, points, { stroke: color, "stroke-width": 1.8 });
    if (points.length) {
      const [cx, cy] = points.at(-1);
      el(svg, "circle", { cx, cy, r: 3, fill: color });
    }
  }
  label(svg, (g.left + g.right) / 2, h - 3, "Elapsed time (s)", {
    "text-anchor": "middle",
  });
  label(svg, 12, (g.top + g.bottom) / 2, "Position (m)", {
    transform: `rotate(-90 12 ${(g.top + g.bottom) / 2})`,
    "text-anchor": "middle",
  });
}
