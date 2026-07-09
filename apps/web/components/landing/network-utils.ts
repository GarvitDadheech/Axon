export type NodeKind = "agent" | "api" | "provider" | "hub" | "peer";

export interface NetworkNode {
  id: number;
  x: number;
  y: number;
  kind: NodeKind;
  r: number;
  opacity: number;
}

/** Deterministic PRNG for stable SSR/client node layouts */
export function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateFieldNodes(
  count: number,
  width: number,
  height: number,
  seed: number,
  exclude: { x: number; y: number; r: number }[] = [],
): NetworkNode[] {
  const rng = createRng(seed);
  const nodes: NetworkNode[] = [];
  let attempts = 0;

  while (nodes.length < count && attempts < count * 40) {
    attempts++;
    const x = rng() * width;
    const y = rng() * height;
    const r = 1 + rng() * 2.2;

    const blocked = exclude.some((z) => {
      const dx = x - z.x;
      const dy = y - z.y;
      return Math.sqrt(dx * dx + dy * dy) < z.r + 12;
    });
    if (blocked) continue;

    const roll = rng();
    let kind: NodeKind = "peer";
    if (roll > 0.92) kind = "api";
    else if (roll > 0.97) kind = "provider";

    nodes.push({
      id: nodes.length,
      x,
      y,
      kind,
      r,
      opacity: 0.15 + rng() * 0.35,
    });
  }

  return nodes;
}

export interface RoutePoint {
  x: number;
  y: number;
  label: string;
}
