// Canonical editable contours. Handles are absolute coordinates in path space.
export function pathData(contours) {
  const pair = (p) => `${+p.x.toFixed(5)} ${+p.y.toFixed(5)}`;
  return contours
    .map((c) => {
      if (!c.points.length) return "";
      let text = `M${pair(c.points[0])}`;
      for (let i = 1; i < c.points.length + (c.closed ? 1 : 0); i++) {
        const a = c.points[i - 1],
          b = c.points[i % c.points.length];
        const curved =
          a.out.x !== a.x ||
          a.out.y !== a.y ||
          b.in.x !== b.x ||
          b.in.y !== b.y;
        text += curved
          ? ` C${pair(a.out)} ${pair(b.in)} ${pair(b)}`
          : ` L${pair(b)}`;
      }
      return text + (c.closed ? " Z" : "");
    })
    .join(" ");
}
export function parsePath(data) {
  const tokens =
    data.match(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  const contours = [];
  let c,
    index = 0;
  const point = () => ({
    x: Number(tokens[index++]),
    y: Number(tokens[index++]),
  });
  const anchor = (p) => ({ ...p, in: { ...p }, out: { ...p } });
  while (index < tokens.length) {
    const command = tokens[index++];
    if (command === "M") {
      c = { closed: false, points: [anchor(point())] };
      contours.push(c);
    } else if (command === "L") c.points.push(anchor(point()));
    else if (command === "C") {
      const a = point(),
        b = point(),
        p = point();
      c.points.at(-1).out = a;
      if (
        tokens[index] === "Z" &&
        p.x === c.points[0].x &&
        p.y === c.points[0].y
      )
        c.points[0].in = b;
      else {
        const n = anchor(p);
        n.in = b;
        c.points.push(n);
      }
    } else if (command === "Z") {
      c.closed = true;
      const last = c.points.at(-1),
        first = c.points[0];
      if (c.points.length > 1 && last.x === first.x && last.y === first.y) {
        first.in = last.in;
        c.points.pop();
      }
    } else throw Error("Normalize a curva antes de editar os nós.");
  }
  if (
    !contours.length ||
    contours.some((c) =>
      c.points.some(
        (p) =>
          ![p.x, p.y, p.in.x, p.in.y, p.out.x, p.out.y].every(Number.isFinite),
      ),
    )
  )
    throw Error("Curva inválida");
  return contours;
}
export function splitCurve(contour, index) {
  const a = contour.points[index],
    b = contour.points[(index + 1) % contour.points.length];
  if (!b || (!contour.closed && index === contour.points.length - 1))
    return false;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const p = mid(a, a.out),
    q = mid(a.out, b.in),
    r = mid(b.in, b),
    s = mid(p, q),
    t = mid(q, r),
    n = mid(s, t);
  a.out = p;
  b.in = r;
  contour.points.splice(index + 1, 0, { ...n, in: s, out: t });
  return true;
}
