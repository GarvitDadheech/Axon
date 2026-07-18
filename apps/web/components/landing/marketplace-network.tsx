"use client";

import { useMemo } from "react";
import { createRng } from "./network-utils";
import { orthogonalPath } from "./orthogonal-path";

const W = 1200;
const H = 800;

/** Designed clear quadrant — copy embeds here as part of the artwork */
const CLEAR = { x: 0, y: 0, w: 480, h: 360 };

const HUB = { x: 780, y: 380 };
const AGENT = { x: 220, y: 580 };
const PROVIDER = { x: 1080, y: 680 };

const MAIN_ROUTE = orthogonalPath([
  { x: AGENT.x, y: AGENT.y },
  { x: AGENT.x, y: 500 },
  { x: 560, y: 500 },
  { x: 560, y: 300 },
  { x: HUB.x, y: 300 },
  { x: HUB.x, y: HUB.y },
  { x: HUB.x, y: 640 },
  { x: PROVIDER.x, y: 640 },
  { x: PROVIDER.x, y: PROVIDER.y },
]);

const REGISTRY = { x: 640, y: 260, w: 400, h: 250 };

const CATALOG = [
  { id: "weather", col: 0, row: 0 },
  { id: "prices", col: 1, row: 0 },
  { id: "search", col: 2, row: 0 },
  { id: "vision", col: 3, row: 0 },
  { id: "embed", col: 0, row: 1 },
  { id: "translate", col: 1, row: 1 },
  { id: "scrape", col: 2, row: 1 },
  { id: "ocr", col: 3, row: 1 },
  { id: "tts", col: 0, row: 2 },
  { id: "sql", col: 1, row: 2 },
  { id: "maps", col: 2, row: 2 },
  { id: "llm", col: 3, row: 2 },
] as const;

const CELL_W = 82;
const CELL_H = 44;
const CELL_GAP = 10;
const GRID_OX = REGISTRY.x + 24;
const GRID_OY = REGISTRY.y + 36;

interface ClusterNode {
  id: number;
  x: number;
  y: number;
  size: number;
  tier: "bg" | "mid" | "api";
}

function inClearZone(x: number, y: number, pad = 20) {
  return (
    x > CLEAR.x + pad &&
    x < CLEAR.x + CLEAR.w - pad &&
    y > CLEAR.y + pad &&
    y < CLEAR.y + CLEAR.h - pad
  );
}

function generateCluster(
  count: number,
  cx: number,
  cy: number,
  spreadX: number,
  spreadY: number,
  seed: number,
  avoidClear = false,
): ClusterNode[] {
  const rng = createRng(seed);
  const nodes: ClusterNode[] = [];
  let attempts = 0;
  while (nodes.length < count && attempts < count * 30) {
    attempts++;
    const x = cx + (rng() - 0.5) * spreadX;
    const y = cy + (rng() - 0.5) * spreadY;
    if (avoidClear && inClearZone(x, y)) continue;
    const tierRoll = rng();
    nodes.push({
      id: nodes.length,
      x,
      y,
      size: tierRoll > 0.85 ? 3 : tierRoll > 0.6 ? 2 : 1.5,
      tier: tierRoll > 0.88 ? "api" : tierRoll > 0.5 ? "mid" : "bg",
    });
  }
  return nodes;
}

function catalogCell(id: string, col: number, row: number) {
  const x = GRID_OX + col * (CELL_W + CELL_GAP);
  const y = GRID_OY + row * (CELL_H + CELL_GAP);
  const feedRoute = orthogonalPath([
    { x: x + CELL_W / 2, y: y + CELL_H },
    { x: x + CELL_W / 2, y: HUB.y - 24 },
    { x: HUB.x, y: HUB.y - 24 },
    { x: HUB.x, y: HUB.y },
  ]);
  return { id, x, y, w: CELL_W, h: CELL_H, feedRoute, active: id === "prices" || id === "embed" };
}

export function MarketplaceNetwork() {
  const agentCluster = useMemo(
    () => generateCluster(52, AGENT.x, AGENT.y, 180, 120, 11, true),
    [],
  );
  const hubCluster = useMemo(() => generateCluster(80, HUB.x, HUB.y, 240, 200, 22, true), []);
  const providerCluster = useMemo(
    () => generateCluster(48, PROVIDER.x, PROVIDER.y, 160, 130, 33, true),
    [],
  );
  const fieldNodes = useMemo(
    () =>
      generateCluster(120, W * 0.62, H * 0.52, W * 0.78, H * 0.88, 44, true),
    [],
  );

  const catalog = useMemo(
    () => CATALOG.map((c) => catalogCell(c.id, c.col, c.row)),
    [],
  );

  const spineNodes = [
    { ...AGENT, label: "Agent", tier: "primary" as const },
    { ...HUB, label: "Marketplace", tier: "hub" as const },
    { ...PROVIDER, label: "Provider", tier: "primary" as const },
  ];

  return (
    <div className="relative h-full w-full min-h-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full"
        aria-hidden
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="hero-grid-fine" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.5"
            />
          </pattern>
          <pattern id="hero-grid-coarse" width="80" height="80" patternUnits="userSpaceOnUse">
            <rect width="80" height="80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.75" />
          </pattern>
          <linearGradient id="hero-route" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="45%" stopColor="#34d399" stopOpacity="1" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="clear-quadrant" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#080808" stopOpacity="0.72" />
            <stop offset="55%" stopColor="#080808" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#080808" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width={W} height={H} fill="url(#hero-grid-fine)" />
        <rect width={W} height={H} fill="url(#hero-grid-coarse)" opacity="0.55" />

        {/* Designed embed zone — part of the poster, not an overlay */}
        <rect
          x={CLEAR.x}
          y={CLEAR.y}
          width={CLEAR.w}
          height={CLEAR.h}
          fill="url(#clear-quadrant)"
        />
        <g stroke="rgba(255,255,255,0.1)" strokeWidth="0.75" fill="none">
          <path d={`M ${CLEAR.x + 40} ${CLEAR.y + 100} L ${CLEAR.x + 40} ${CLEAR.y + 40} L ${CLEAR.x + 100} ${CLEAR.y + 40}`} />
          <path d={`M ${CLEAR.x + CLEAR.w - 40} ${CLEAR.y + CLEAR.h} L ${CLEAR.x + CLEAR.w - 40} ${CLEAR.y + CLEAR.h - 48} L ${CLEAR.x + CLEAR.w - 100} ${CLEAR.y + CLEAR.h - 48}`} />
        </g>
        <text
          x={CLEAR.x + 44}
          y={CLEAR.y + 32}
          fill="rgba(255,255,255,0.18)"
          style={{ fontSize: "8px", fontFamily: "var(--font-geist-mono)" }}
        >
          COMPOSITION.ZONE · 0,0
        </text>

        {fieldNodes.map((n) => (
          <rect
            key={`f-${n.id}`}
            x={n.x - n.size}
            y={n.y - n.size}
            width={n.size * 2}
            height={n.size * 2}
            fill={`rgba(255,255,255,${n.tier === "api" ? 0.08 : 0.03})`}
          />
        ))}

        {[...agentCluster, ...hubCluster, ...providerCluster].map((n, i) => (
          <rect
            key={`c-${i}`}
            x={n.x - n.size}
            y={n.y - n.size}
            width={n.size * 2}
            height={n.size * 2}
            fill={
              n.tier === "api"
                ? "rgba(16,185,129,0.35)"
                : n.tier === "mid"
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(255,255,255,0.04)"
            }
          />
        ))}

        <rect
          x={REGISTRY.x}
          y={REGISTRY.y}
          width={REGISTRY.w}
          height={REGISTRY.h}
          fill="rgba(255,255,255,0.015)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
        <text
          x={REGISTRY.x + 16}
          y={REGISTRY.y + 22}
          fill="rgba(255,255,255,0.3)"
          style={{ fontSize: "9px", fontFamily: "var(--font-geist-mono)" }}
        >
          API REGISTRY · 12 LISTINGS
        </text>
        <line
          x1={REGISTRY.x}
          y1={REGISTRY.y + 30}
          x2={REGISTRY.x + REGISTRY.w}
          y2={REGISTRY.y + 30}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.75"
        />

        {catalog.map((cell) => (
          <g key={cell.id}>
            <path
              d={cell.feedRoute}
              fill="none"
              stroke={cell.active ? "rgba(16,185,129,0.22)" : "rgba(255,255,255,0.04)"}
              strokeWidth="0.75"
            />
            <rect
              x={cell.x}
              y={cell.y}
              width={cell.w}
              height={cell.h}
              fill={cell.active ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)"}
              stroke={cell.active ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.07)"}
              strokeWidth="0.75"
            />
            <text
              x={cell.x + cell.w / 2}
              y={cell.y + cell.h / 2 + 3}
              textAnchor="middle"
              fill={cell.active ? "rgba(52,211,153,0.7)" : "rgba(255,255,255,0.28)"}
              style={{ fontSize: "8px", fontFamily: "var(--font-geist-mono)" }}
            >
              {cell.id}
            </text>
          </g>
        ))}

        <path d={MAIN_ROUTE} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />

        <path
          d={MAIN_ROUTE}
          fill="none"
          stroke="url(#hero-route)"
          strokeWidth="2.5"
          strokeDasharray="14 10"
          className="route-trace"
        />

        <rect width="10" height="10" fill="#34d399" x="-5" y="-5">
          <animateMotion dur="7s" repeatCount="indefinite" path={MAIN_ROUTE} />
        </rect>

        {spineNodes.map((node) => {
          const isPrimary = node.tier === "primary";
          const size = isPrimary ? 16 : 12;
          return (
            <g key={node.label}>
              <line
                x1={node.x - 28}
                y1={node.y}
                x2={node.x + 28}
                y2={node.y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="0.5"
              />
              <line
                x1={node.x}
                y1={node.y - 28}
                x2={node.x}
                y2={node.y + 28}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="0.5"
              />
              <rect
                x={node.x - size - 6}
                y={node.y - size - 6}
                width={(size + 6) * 2}
                height={(size + 6) * 2}
                fill="none"
                stroke={isPrimary ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}
                strokeWidth="0.75"
                strokeDasharray="4 3"
              />
              <rect
                x={node.x - size}
                y={node.y - size}
                width={size * 2}
                height={size * 2}
                fill={isPrimary ? "#10b981" : "rgba(16,185,129,0.22)"}
                stroke="#34d399"
                strokeWidth="1.25"
              />
              <text
                x={node.x}
                y={node.y + (node.label === "Agent" ? -26 : 34)}
                textAnchor="middle"
                fill="rgba(255,255,255,0.45)"
                style={{ fontSize: "10px", fontFamily: "var(--font-geist-mono)", fontWeight: 500 }}
              >
                {node.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        <g stroke="rgba(255,255,255,0.14)" strokeWidth="0.75" fill="none">
          <path d="M 32 32 L 32 56 L 56 56" />
          <path d={`M ${W - 32} ${H - 32} L ${W - 32} ${H - 56} L ${W - 56} ${H - 56}`} />
        </g>

        <g transform={`translate(${W - 148}, ${H - 56})`}>
          <rect width="116" height="36" fill="rgba(8,8,8,0.6)" stroke="rgba(255,255,255,0.08)" />
          <text x="10" y="14" fill="rgba(255,255,255,0.28)" style={{ fontSize: "8px", fontFamily: "var(--font-geist-mono)" }}>
            SETTLEMENT
          </text>
          <text x="10" y="28" fill="rgba(52,211,153,0.75)" style={{ fontSize: "9px", fontFamily: "var(--font-geist-mono)" }}>
            arbitrum · 421614
          </text>
        </g>
      </svg>
    </div>
  );
}
