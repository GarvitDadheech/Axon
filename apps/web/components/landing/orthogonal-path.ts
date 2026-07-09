/** Build an SVG path using only horizontal and vertical segments (Manhattan routing). */
export function orthogonalPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    if (prev.x !== curr.x) d += ` L ${curr.x} ${prev.y}`;
    if (prev.y !== curr.y || prev.x === curr.x) d += ` L ${curr.x} ${curr.y}`;
  }
  return d;
}
