import { useCallback, useEffect, useState } from "react";
import type { PhaseId } from "./lesson-types";
import { getCurrentFileId } from "./pdf-images";


export type SlidePhase = PhaseId | "cover" | "extend";

export interface Slide {
  id: number;
  type: "cover" | "content" | "homework" | "blank";
  phase: SlidePhase;
  title: string;
  /** cover only */
  subject?: string;
  grade?: string;
  outcomes?: string[];
  /** content only */
  points?: string[];
  question?: string;
  pageNumber?: number;
  hasDiagram?: boolean;
  hasActivity?: boolean;
  /** homework only */
  homework?: string;
}

export interface AnalyzedPage {
  pageNumber: number;
  pageContent: string;
  bestPhase: PhaseId;
  reasonAr: string;
  slideTitle: string;
  keyPoints: string[];
  studentQuestion: string;
  hasActivity: boolean;
  hasDiagram: boolean;
}

export const PRESENTATION_KEY = "rz_presentation";
export const EXEC_PHASE_KEY = "rz_exec_phase";

/* ---------------- localStorage (slides only, no images) ---------------- */

export function loadSlides(): Slide[] {
  try {
    const raw = localStorage.getItem(PRESENTATION_KEY);
    return raw ? (JSON.parse(raw) as Slide[]) : [];
  } catch {
    return [];
  }
}

export function saveSlides(slides: Slide[]) {
  try {
    localStorage.setItem(PRESENTATION_KEY, JSON.stringify(slides));
    window.dispatchEvent(new Event("rz-presentation"));
  } catch (e) {
    console.error(e);
  }
}

export function usePresentation(): [Slide[], (s: Slide[]) => void] {
  const [slides, setSlides] = useState<Slide[]>([]);

  useEffect(() => {
    const sync = () => setSlides(loadSlides());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("rz-presentation", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rz-presentation", sync);
    };
  }, []);

  const set = useCallback((s: Slide[]) => {
    setSlides(s);
    saveSlides(s);
  }, []);

  return [slides, set];
}

/* ---------------- IndexedDB (page images, too large for localStorage) ---------------- */
/* كل صورة مخزّنة بمفتاح "<معرّف الملف>:<رقم الصفحة>" حتى لا تتسرّب صور درس إلى درس آخر. */

const DB_NAME = "rz_pages";
const STORE = "images";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function keyFor(pageNumber: number, fileId: string) {
  return `${fileId}:${pageNumber}`;
}

export async function putPageImage(pageNumber: number, dataUrl: string, fileId?: string) {
  const id = fileId ?? getCurrentFileId();
  if (!id) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(dataUrl, keyFor(pageNumber, id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getPageImage(
  pageNumber: number,
  fileId?: string,
): Promise<string | null> {
  const id = fileId ?? getCurrentFileId();
  if (!id) return null;
  const db = await openDb();
  const value = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(keyFor(pageNumber, id));
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

/** يمسح كل صور الصفحات لكل الملفات — لا يترك أثراً لأي درس سابق. */
export async function clearPageImages() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** يحذف صور كل الملفات ما عدا الملف المحدّد — يمنع تراكم الملفات. */
export async function keepOnlyFile(fileId: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      for (const k of req.result) {
        if (typeof k !== "string" || !k.startsWith(`${fileId}:`)) store.delete(k);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}


/* ---------------- Build ---------------- */

export function buildPresentation(
  analyzed: AnalyzedPage[],
  lesson: {
    topic: string;
    subject: string;
    grade: string;
    outcomes?: string[];
    homework: { studentText: string };
  },
): Slide[] {
  const slides: Slide[] = [
    {
      id: 0,
      type: "cover",
      phase: "cover",
      title: lesson.topic || "درس اليوم",
      subject: lesson.subject,
      grade: lesson.grade,
      outcomes: lesson.outcomes ?? [],
    },
  ];

  const order: PhaseId[] = ["engage", "explore", "explain", "elaborate", "evaluate"];
  order.forEach((phase) => {
    analyzed
      .filter((p) => p.bestPhase === phase)
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .forEach((page) => {
        slides.push({
          id: slides.length,
          type: "content",
          phase,
          title: page.slideTitle,
          points: page.keyPoints,
          question: page.studentQuestion,
          pageNumber: page.pageNumber,
          hasDiagram: page.hasDiagram,
          hasActivity: page.hasActivity,
        });
      });
  });

  slides.push({
    id: slides.length,
    type: "homework",
    phase: "extend",
    title: "تحدّيك المنزلي",
    homework: lesson.homework.studentText,
  });

  return slides;
}

export function reindex(slides: Slide[]): Slide[] {
  return slides.map((s, i) => ({ ...s, id: i }));
}

export const PHASE_LABELS: Record<SlidePhase, { ar: string; color: string }> = {
  cover: { ar: "الغلاف", color: "#1B2A4A" },
  engage: { ar: "الإشراك", color: "#B8860B" },
  explore: { ar: "الاستكشاف", color: "#1E7CA8" },
  explain: { ar: "التفسير", color: "#1B2A4A" },
  elaborate: { ar: "التوسيع", color: "#5D3FA0" },
  evaluate: { ar: "التقويم", color: "#1A5C2A" },
  extend: { ar: "الواجب", color: "#888888" },
};

/** أرقام صفحات الكتاب المخزّنة للملف المرفوع حالياً فقط */
export async function listPageNumbers(fileId?: string): Promise<number[]> {
  const id = fileId ?? getCurrentFileId();
  if (!id) return [];
  const db = await openDb();
  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  const prefix = `${id}:`;
  return keys
    .filter((k): k is string => typeof k === "string" && k.startsWith(prefix))
    .map((k) => Number(k.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

}
