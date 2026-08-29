import pptxgen from "pptxgenjs";
import { useCallback, useEffect, useState } from "react";
import type { PhaseId } from "./lesson-types";
import { getCurrentFileId } from "./pdf-images";

export type SlidePhase = PhaseId | "cover" | "extend";

export interface Slide {
  videoDataUrl?: string;
  videoName?: string;

  audioDataUrl?: string;
  audioName?: string;

  imageDataUrl?: string;
  imageUrl?: string;
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

export async function getPageImage(pageNumber: number, fileId?: string): Promise<string | null> {
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
export async function downloadPresentationPptx(slides: Slide[], fileName = "lesson-presentation") {
  const pptx = new pptxgen();

  pptx.layout = "LAYOUT_WIDE";

  pptx.author = "Lesson Spark";
  pptx.subject = "Lesson Presentation";
  pptx.title = fileName;
  pptx.company = "Al-Ramz School";

  pptx.theme = {
    headFontFace: "Arial",
    bodyFontFace: "Arial",
  };

  for (const item of slides) {
    const slide = pptx.addSlide();

    /* =====================================================
       تحديد الصورة التي ستستخدمها الشريحة
    ===================================================== */

    let imageData: string | null = item.imageDataUrl || item.imageUrl || null;

    /*
     * إذا لم تضف المعلمة صورة يدوياً،
     * نحاول أخذ صورة صفحة الكتاب.
     */
    if (!imageData && item.pageNumber != null) {
      try {
        imageData = await getPageImage(item.pageNumber);
      } catch (error) {
        console.warn(`Unable to load page image for page ${item.pageNumber}`, error);
      }
    }

    const hasImage = Boolean(imageData);

    /* =====================================================
       الخلفية
    ===================================================== */

    slide.background = {
      color: "FFFFFF",
    };

    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.18,
      fill: {
        color: "B8860B",
      },
      line: {
        color: "B8860B",
      },
    });

    /* =====================================================
       Cover Slide
    ===================================================== */

    if (item.type === "cover") {
      slide.addText(item.title || "درس اليوم", {
        x: 1,
        y: 0.8,
        w: 11.3,
        h: 0.8,
        fontSize: 30,
        bold: true,
        align: "center",
        color: "1B2A4A",
        rtlMode: true,
        margin: 0.08,
      });

      if (item.subject) {
        slide.addText(item.subject, {
          x: 1,
          y: 1.7,
          w: 11.3,
          h: 0.45,
          fontSize: 18,
          align: "center",
          color: "666666",
          rtlMode: true,
        });
      }

      if (item.grade) {
        slide.addText(item.grade, {
          x: 1,
          y: 2.15,
          w: 11.3,
          h: 0.4,
          fontSize: 16,
          align: "center",
          color: "888888",
          rtlMode: true,
        });
      }

      /*
       * صورة الغلاف إذا أضافتها المعلمة.
       */
      if (imageData) {
        slide.addImage({
          data: imageData,
          x: 4.45,
          y: 2.7,
          w: 4.4,
          h: 2.2,
        });
      }

      if (item.outcomes && item.outcomes.length > 0) {
        const outcomesY = hasImage ? 5.15 : 3.25;

        slide.addText("نواتج التعلم", {
          x: 1.2,
          y: outcomesY,
          w: 10.9,
          h: 0.4,
          fontSize: 18,
          bold: true,
          align: "right",
          color: "B8860B",
          rtlMode: true,
        });

        const outcomesText = item.outcomes.map((outcome) => `• ${outcome}`).join("\n");

        slide.addText(outcomesText, {
          x: 1.2,
          y: outcomesY + 0.45,
          w: 10.9,
          h: hasImage ? 1.3 : 2.3,
          fontSize: 14,
          align: "right",
          valign: "top",
          color: "1B2A4A",
          rtlMode: true,
          breakLine: false,
          margin: 0.1,
        });
      }

      continue;
    }

    /* =====================================================
       Content / Blank Slide
    ===================================================== */

    if (item.type === "content" || item.type === "blank") {
      slide.addText(item.title || "عنوان الشريحة", {
        x: 0.8,
        y: 0.55,
        w: 11.7,
        h: 0.65,
        fontSize: 24,
        bold: true,
        align: "right",
        color: "1B2A4A",
        rtlMode: true,
      });

      /*
       * إذا هناك صورة:
       * النص يأخذ تقريباً نصف الشريحة.
       *
       * إذا لا توجد:
       * النص يستخدم العرض بالكامل.
       */
      const textWidth = hasImage ? 6.1 : 11.5;

      if (item.points && item.points.length > 0) {
        const pointsText = item.points.map((point) => `• ${point}`).join("\n");

        slide.addText(pointsText, {
          x: 0.9,
          y: 1.45,
          w: textWidth,
          h: 3.8,
          fontSize: 18,
          align: "right",
          valign: "top",
          color: "2D3748",
          rtlMode: true,
          margin: 0.12,
        });
      }

      /*
       * الصورة:
       * - الصورة اليدوية أولاً
       * - وإلا صورة صفحة الكتاب.
       */
      if (imageData) {
        slide.addImage({
          data: imageData,
          x: 7.35,
          y: 1.4,
          w: 5.05,
          h: 3.75,
        });
      }

      if (item.question) {
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 1,
          y: 5.55,
          w: 11.2,
          h: 1.15,
          rectRadius: 0.08,
          fill: {
            color: "FBF4E3",
          },
          line: {
            color: "B8860B",
            width: 1,
          },
        });

        slide.addText(`سؤال للطالب: ${item.question}`, {
          x: 1.25,
          y: 5.85,
          w: 10.7,
          h: 0.5,
          fontSize: 16,
          bold: true,
          align: "right",
          color: "1B2A4A",
          rtlMode: true,
        });
      }

      /*
       * اسم المرحلة.
       */
      slide.addText(String(item.phase ?? ""), {
        x: 0.6,
        y: 6.9,
        w: 2.5,
        h: 0.3,
        fontSize: 10,
        color: "999999",
        align: "left",
      });

      continue;
    }

    /* =====================================================
       Homework Slide
    ===================================================== */

    if (item.type === "homework") {
      slide.addText(item.title || "تحدّيك المنزلي", {
        x: 1,
        y: 0.8,
        w: 11.3,
        h: 0.8,
        fontSize: 28,
        bold: true,
        align: "center",
        color: "1B2A4A",
        rtlMode: true,
      });

      /*
       * صورة مضافة إلى الواجب.
       */
      if (imageData) {
        slide.addImage({
          data: imageData,
          x: 4.35,
          y: 1.7,
          w: 4.6,
          h: 2.4,
        });
      }

      slide.addShape(pptx.ShapeType.roundRect, {
        x: 1.2,
        y: hasImage ? 4.35 : 2.3,
        w: 10.9,
        h: hasImage ? 2 : 3,
        fill: {
          color: "FBF4E3",
        },
        line: {
          color: "B8860B",
          width: 1.3,
        },
      });

      slide.addText(item.homework || "لا يوجد واجب محدد.", {
        x: 1.6,
        y: hasImage ? 4.75 : 2.8,
        w: 10.1,
        h: hasImage ? 1.2 : 2,
        fontSize: 20,
        align: "right",
        valign: "middle",
        color: "1B2A4A",
        rtlMode: true,
        margin: 0.12,
      });
    }
  }

  /* =====================================================
     File Name
  ===================================================== */

  const safeFileName = fileName.replace(/[\\/:*?"<>|]/g, "-").trim() || "lesson-presentation";

  await pptx.writeFile({
    fileName: `${safeFileName}.pptx`,
  });
}
