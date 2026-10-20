export function ease(t, type) {
  if (type === "ease-in") return t * t;
  if (type === "ease-out") return 1 - (1 - t) ** 2;
  if (type === "ease-in-out")
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  return t;
}
export function evaluateMotion(document, time, animationTimes) {
  const doc = structuredClone(document);
  for (const animation of doc.animations || []) {
    const elapsed = animationTimes ? animationTimes[animation.id] : time;
    if (elapsed === undefined) continue;
    const n = doc.nodes.find((n) => n.id === animation.nodeId);
    if (!n) continue;
    const frames = animation.keyframes;
    const t = Math.max(0, Math.min(animation.duration, elapsed));
    const props = new Set(frames.flatMap((f) => Object.keys(f.values)));
    for (const key of props) {
      const points = frames.filter((f) => key in f.values);
      if (!points.length) continue;
      let a = points[0],
        b = points.at(-1);
      for (const f of points) {
        if (f.time <= t) a = f;
        if (f.time >= t) {
          b = f;
          break;
        }
      }
      const progress =
        a.time === b.time
          ? 0
          : ease(
              Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time))),
              animation.easing,
            );
      n[key] = a.values[key] + (b.values[key] - a.values[key]) * progress;
    }
  }
  return doc;
}
