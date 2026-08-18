import { fmtTime, type ExecTimerState } from "@/lib/exec-timer";

/** Compact ring timer used as an overlay on top of the slide screen. */
export function TimerBadge({
  state,
  size = 120,
}: {
  state: ExecTimerState;
  size?: number;
}) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct =
    state.durationSec > 0 ? 1 - state.secondsLeft / state.durationSec : 0;
  const warning = state.secondsLeft > 0 && state.secondsLeft <= 120;

  return (
    <div
      dir="rtl"
      className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/55 px-3 py-2 backdrop-blur"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={7}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={state.color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * pct}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`font-extrabold tabular-nums leading-none tracking-[-1px] ${
              warning ? "animate-pulse text-[#FC8181]" : "text-white"
            }`}
            style={{ fontSize: size * 0.28 }}
          >
            {fmtTime(state.secondsLeft)}
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold text-white"
          style={{ background: state.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {state.phaseAr}
        </div>
        <div className="mt-1 text-[11px] text-white/60">
          {state.phaseIdx + 1}/{state.phaseCount} · {state.running ? "يعمل" : "متوقف"}
        </div>
      </div>
    </div>
  );
}
