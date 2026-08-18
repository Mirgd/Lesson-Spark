import { useEffect, useState } from "react";

export const EXEC_TIMER_KEY = "rz_exec_timer";

export interface ExecTimerState {
  phaseAr: string;
  phaseEn: string;
  color: string;
  secondsLeft: number;
  durationSec: number;
  running: boolean;
  phaseIdx: number;
  phaseCount: number;
  updatedAt: number;
}

export function publishExecTimer(state: Omit<ExecTimerState, "updatedAt">) {
  try {
    localStorage.setItem(
      EXEC_TIMER_KEY,
      JSON.stringify({ ...state, updatedAt: Date.now() } satisfies ExecTimerState),
    );
  } catch (e) {
    console.error(e);
  }
}

function read(): ExecTimerState | null {
  try {
    const raw = localStorage.getItem(EXEC_TIMER_KEY);
    return raw ? (JSON.parse(raw) as ExecTimerState) : null;
  } catch {
    return null;
  }
}

/** Reads the live timer published by /execute (works across windows). */
export function useExecTimer(): ExecTimerState | null {
  const [state, setState] = useState<ExecTimerState | null>(null);

  useEffect(() => {
    const sync = () => setState(read());
    sync();
    window.addEventListener("storage", sync);
    const id = setInterval(sync, 500);
    return () => {
      window.removeEventListener("storage", sync);
      clearInterval(id);
    };
  }, []);

  return state;
}

export function fmtTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
