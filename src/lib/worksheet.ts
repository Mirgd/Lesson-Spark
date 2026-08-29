import { useCallback, useEffect, useState } from "react";

export interface WorksheetItem {
  /** index of the linked slide inside the saved presentation */
  slideIndex: number;
  slideTitle: string;
  phase: string;
  questions: string[];
  /** model answer for each question (same order as questions) */
  answers?: string[];
  selfCheck: string;
}

/** feedback the student gives after seeing the model answer */
export type FeedbackValue = "correct" | "partial" | "unclear";

export const FEEDBACK_OPTIONS: { value: FeedbackValue; label: string; color: string }[] = [
  { value: "correct", label: "✅ إجابتي صحيحة", color: "#16794A" },
  { value: "partial", label: "🟡 قريبة — ينقصها تفصيل", color: "#B8860B" },
  { value: "unclear", label: "🔁 أحتاج شرحاً أوضح", color: "#B45309" },
];

export const WORKSHEET_KEY = "rz_worksheet";
export const WORKSHEET_ANSWERS_KEY = "rz_worksheet_answers";
export const WORKSHEET_FEEDBACK_KEY = "rz_worksheet_feedback";

export function loadWorksheet(): WorksheetItem[] {
  try {
    const raw = localStorage.getItem(WORKSHEET_KEY);
    return raw ? (JSON.parse(raw) as WorksheetItem[]) : [];
  } catch {
    return [];
  }
}

export function saveWorksheet(items: WorksheetItem[]) {
  try {
    localStorage.setItem(WORKSHEET_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("rz-worksheet"));
  } catch (e) {
    console.error(e);
  }
}

export function useWorksheet(): [WorksheetItem[], (v: WorksheetItem[]) => void] {
  const [items, setItems] = useState<WorksheetItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(loadWorksheet());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("rz-worksheet", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rz-worksheet", sync);
    };
  }, []);

  const set = useCallback((v: WorksheetItem[]) => {
    setItems(v);
    saveWorksheet(v);
  }, []);

  return [items, set];
}

/* ---------------- student self-check state ---------------- */

export function loadAnswers(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(WORKSHEET_ANSWERS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function useSelfCheck(): [Record<string, boolean>, (key: string) => void] {
  const [state, setState] = useState<Record<string, boolean>>({});

  useEffect(() => setState(loadAnswers()), []);

  const toggle = useCallback((key: string) => {
    setState((prev) => {
      const nextState = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(WORKSHEET_ANSWERS_KEY, JSON.stringify(nextState));
      } catch (e) {
        console.error(e);
      }
      return nextState;
    });
  }, []);

  return [state, toggle];
}

/* ---------------- per-question feedback state ---------------- */

export function useQuestionFeedback(): [
  Record<string, FeedbackValue>,
  (key: string, value: FeedbackValue) => void,
] {
  const [state, setState] = useState<Record<string, FeedbackValue>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKSHEET_FEEDBACK_KEY);
      if (raw) setState(JSON.parse(raw) as Record<string, FeedbackValue>);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const set = useCallback((key: string, value: FeedbackValue) => {
    setState((prev) => {
      const nextState: Record<string, FeedbackValue> =
        prev[key] === value ? { ...prev } : { ...prev, [key]: value };
      if (prev[key] === value) delete nextState[key];
      try {
        localStorage.setItem(WORKSHEET_FEEDBACK_KEY, JSON.stringify(nextState));
      } catch (e) {
        console.error(e);
      }
      return nextState;
    });
  }, []);

  return [state, set];
}
