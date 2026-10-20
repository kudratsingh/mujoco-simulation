// Pure motion and sampling helpers, shared with the Node tests. No FK here:
// the actual positions and transforms always come from the Python endpoint.
export function wrapDegrees(value) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

export function motionAngles(pattern, phase, base) {
  if (!Number.isFinite(phase) || phase < 0 || phase > 1)
    throw new RangeError("Phase must be in [0,1]");
  const wave = Math.sin(2 * Math.PI * phase);
  if (pattern === "shoulder")
    return [wrapDegrees(base[0] + 80 * wave), base[1]];
  if (pattern === "elbow") return [base[0], wrapDegrees(base[1] + 100 * wave)];
  if (pattern === "both")
    return [
      wrapDegrees(base[0] + 70 * wave),
      wrapDegrees(base[1] + 85 * Math.sin(4 * Math.PI * phase)),
    ];
  throw new RangeError("Unknown motion pattern");
}

export function splitWrappedPath(samples) {
  // Opposite edges are adjacent on the torus. Break lines at the display seam
  // instead of drawing a false diagonal across the joint-angle chart.
  const segments = [];
  for (const point of samples) {
    const segment = segments[segments.length - 1];
    const previous = segment?.[segment.length - 1];
    if (
      !previous ||
      Math.abs(point[0] - previous[0]) > 180 ||
      Math.abs(point[1] - previous[1]) > 180
    ) {
      segments.push([point]);
    } else segment.push(point);
  }
  return segments;
}
