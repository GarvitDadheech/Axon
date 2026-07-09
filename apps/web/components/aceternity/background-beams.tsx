"use client";

const BEAMS = [
  { left: "10%", duration: "8s",   delay: "0s" },
  { left: "24%", duration: "10s",  delay: "0.8s" },
  { left: "40%", duration: "7.5s", delay: "1.6s" },
  { left: "58%", duration: "9s",   delay: "0.4s" },
  { left: "74%", duration: "8.5s", delay: "1.2s" },
  { left: "88%", duration: "7s",   delay: "2s" },
];

export function BackgroundBeams({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Dot grid */}
      <div className="absolute inset-0 dot-grid opacity-35" />

      {/* Top violet glow */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 animate-glow-pulse"
        style={{
          width: "140%",
          height: "700px",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(109,40,217,0.22) 0%, transparent 65%)",
        }}
      />

      {/* Vertical beam lines */}
      {BEAMS.map((b, i) => (
        <div
          key={i}
          className="animate-beam-flicker absolute top-0 h-full w-px"
          style={{
            left: b.left,
            animationDuration: b.duration,
            animationDelay: b.delay,
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(124,58,237,0.16) 28%, rgba(139,92,246,0.28) 52%, rgba(124,58,237,0.16) 74%, transparent 100%)",
          }}
        />
      ))}

      {/* Radial edge mask */}
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_96%_80%_at_50%_35%,black_55%,transparent_100%)]" />
    </div>
  );
}
