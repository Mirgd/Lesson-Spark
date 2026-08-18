import { useCallback, useEffect, useState } from "react";
import type { PhaseId } from "./lesson-types";

export interface BankQuestion {
  id: string;
  phase: PhaseId | string;
  subject: string;
  topic: string;
  text: string;
  answer: string;
  /** تدرج التقييم 1-5 */
  rating: number;
  uses: number;
  createdAt: string;
  selected?: boolean;
}

export const QUESTION_BANK_KEY = "rz_question_bank";

/** تدرج تقييم جودة السؤال */
export const RATING_SCALE: { value: number; label: string; color: string }[] = [
  { value: 1, label: "ضعيف — يحتاج إعادة صياغة", color: "#B45309" },
  { value: 2, label: "مقبول — تذكّر فقط", color: "#B8860B" },
  { value: 3, label: "جيد — فهم", color: "#1E7CA8" },
  { value: 4, label: "جيد جداً — تطبيق", color: "#1B2A4A" },
  { value: 5, label: "ممتاز — تفكير عليا", color: "#16794A" },
];

export function loadBank(): BankQuestion[] {
  try {
    const raw = localStorage.getItem(QUESTION_BANK_KEY);
    return raw ? (JSON.parse(raw) as BankQuestion[]) : [];
  } catch {
    return [];
  }
}

function persist(items: BankQuestion[]) {
  try {
    localStorage.setItem(QUESTION_BANK_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("rz-question-bank"));
  } catch (e) {
    console.error(e);
  }
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export function useQuestionBank() {
  const [items, setItems] = useState<BankQuestion[]>([]);

  useEffect(() => {
    const sync = () => setItems(loadBank());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("rz-question-bank", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rz-question-bank", sync);
    };
  }, []);

  const write = useCallback((next: BankQuestion[]) => {
    setItems(next);
    persist(next);
  }, []);

  /** يضيف الأسئلة الجديدة فقط (يتجاهل المكرر بنفس النص) */
  const addMany = useCallback(
    (incoming: Omit<BankQuestion, "id" | "rating" | "uses" | "createdAt">[]) => {
      const current = loadBank();
      const existing = new Set(current.map((q) => norm(q.text)));
      const fresh = incoming
        .filter((q) => norm(q.text) && !existing.has(norm(q.text)))
        .map((q) => ({
          ...q,
          id: crypto.randomUUID(),
          rating: 0,
          uses: 0,
          createdAt: new Date().toISOString(),
        }));
      if (fresh.length === 0) return 0;
      const next = [...fresh, ...current];
      setItems(next);
      persist(next);
      return fresh.length;
    },
    [],
  );

  const update = useCallback((id: string, patch: Partial<BankQuestion>) => {
    const next = loadBank().map((q) => (q.id === id ? { ...q, ...patch } : q));
    setItems(next);
    persist(next);
  }, []);

  const remove = useCallback((id: string) => {
    const next = loadBank().filter((q) => q.id !== id);
    setItems(next);
    persist(next);
  }, []);

  const markUsed = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const next = loadBank().map((q) => (set.has(q.id) ? { ...q, uses: q.uses + 1 } : q));
    setItems(next);
    persist(next);
  }, []);

  return { items, write, addMany, update, remove, markUsed };
}

/** الأسئلة المختارة لإعادة الاستخدام في ورقة العمل القادمة */
export function selectedQuestions(): BankQuestion[] {
  return loadBank().filter((q) => q.selected);
}

/** إضافة أسئلة للبنك من خارج React (مثل خط الاستخراج التلقائي) */
export function addQuestionsToBank(
  incoming: Omit<BankQuestion, "id" | "rating" | "uses" | "createdAt">[],
): number {
  const current = loadBank();
  const existing = new Set(current.map((q) => norm(q.text)));
  const fresh = incoming
    .filter((q) => norm(q.text) && !existing.has(norm(q.text)))
    .map((q) => ({
      ...q,
      id: crypto.randomUUID(),
      rating: 0,
      uses: 0,
      createdAt: new Date().toISOString(),
    }));
  if (!fresh.length) return 0;
  persist([...fresh, ...current]);
  return fresh.length;
}
