interface GateMarkProps {
  size?: number;
  state?: "idle" | "open" | "closed";
  className?: string;
}

/**
 * The gate mark: two arcs that meet at a threshold. Idle = both arcs at
 * rest. Open = arcs pull apart (access granted). Closed = arcs cinch
 * tight (access denied / already used).
 */
export function GateMark({ size = 32, state = "idle", className }: GateMarkProps) {
  const gap = state === "open" ? 26 : state === "closed" ? 4 : 14;
  const color =
    state === "open" ? "var(--color-moon)" : state === "closed" ? "var(--color-signal)" : "var(--color-veil)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d={`M ${24 - gap} 8 A 16 16 0 0 0 ${24 - gap} 40`}
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        style={{ transition: "d 0.5s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease" }}
      />
      <path
        d={`M ${24 + gap} 8 A 16 16 0 0 1 ${24 + gap} 40`}
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        style={{ transition: "d 0.5s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease" }}
      />
      <circle cx="24" cy="24" r="2.5" fill={color} style={{ transition: "fill 0.3s ease" }} />
    </svg>
  );
}
