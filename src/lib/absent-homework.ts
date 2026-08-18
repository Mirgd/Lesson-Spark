import { useCallback, useEffect, useState } from "react";
import type { AbsentHomework } from "./homework.functions";

export type { AbsentHomework };

export const ABSENT_HOMEWORK_KEY = "rz_absent_homework";

export function loadAbsentHomework(): AbsentHomework | null {
  try {
    const raw = localStorage.getItem(ABSENT_HOMEWORK_KEY);
    return raw ? (JSON.parse(raw) as AbsentHomework) : null;
  } catch {
    return null;
  }
}

export function saveAbsentHomework(hw: AbsentHomework | null) {
  try {
    if (hw) localStorage.setItem(ABSENT_HOMEWORK_KEY, JSON.stringify(hw));
    else localStorage.removeItem(ABSENT_HOMEWORK_KEY);
    window.dispatchEvent(new Event("rz-absent-homework"));
  } catch (e) {
    console.error(e);
  }
}

export function useAbsentHomework(): [AbsentHomework | null, (hw: AbsentHomework | null) => void] {
  const [hw, setHw] = useState<AbsentHomework | null>(null);

  useEffect(() => {
    const sync = () => setHw(loadAbsentHomework());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("rz-absent-homework", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rz-absent-homework", sync);
    };
  }, []);

  const set = useCallback((v: AbsentHomework | null) => {
    setHw(v);
    saveAbsentHomework(v);
  }, []);

  return [hw, set];
}
