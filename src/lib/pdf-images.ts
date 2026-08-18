// Browser-only: render PDF pages to JPEG images.
// Shared, page-wide store for the uploaded curriculum file so every section
// (outcomes, presentation, illustrations) reuses the same upload.
import { useEffect, useState } from "react";

export const FILE_ID_KEY = "rz_file_id";
export const FILE_NAME_KEY = "rz_file_name";

let lastPdfFile: File | null = null;
let lastFileName = "";
let currentFileId = "";

function readStoredId() {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(FILE_ID_KEY) ?? "";
  } catch {
    return "";
  }
}

/** معرّف الملف المرفوع حالياً — كل صورة/تحليل مرتبط به. */
export function getCurrentFileId(): string {
  if (!currentFileId) currentFileId = readStoredId();
  return currentFileId;
}

function makeFileId(file: File): string {
  const safe = file.name.replace(/[^\w.\u0600-\u06FF-]+/g, "_").slice(0, 40);
  return `${safe}_${file.size}_${file.lastModified}`;
}

export function setLastPdfFile(file: File | null) {
  lastPdfFile = file;
  lastFileName = file?.name ?? "";
  currentFileId = file ? makeFileId(file) : "";
  if (typeof window !== "undefined") {
    try {
      if (file) {
        localStorage.setItem(FILE_ID_KEY, currentFileId);
        localStorage.setItem(FILE_NAME_KEY, lastFileName);
      } else {
        localStorage.removeItem(FILE_ID_KEY);
        localStorage.removeItem(FILE_NAME_KEY);
      }
    } catch (e) {
      console.error(e);
    }
    window.dispatchEvent(new Event("rz-pdf-file"));
  }
}

export function getLastPdfFile() {
  return lastPdfFile;
}

export function getSharedFileName() {
  return lastFileName;
}

/** Shared uploaded-file state for all planning sections. */
export function useSharedFile(): { file: File | null; name: string; fileId: string } {
  const [state, setState] = useState<{ file: File | null; name: string; fileId: string }>({
    file: null,
    name: "",
    fileId: "",
  });
  useEffect(() => {
    const sync = () =>
      setState({
        file: getLastPdfFile(),
        name: getSharedFileName(),
        fileId: getCurrentFileId(),
      });
    sync();
    window.addEventListener("rz-pdf-file", sync);
    return () => window.removeEventListener("rz-pdf-file", sync);
  }, []);
  return state;
}



export interface PageImage {
  page: number;
  /** full data URL */
  dataUrl: string;
  /** base64 payload without prefix */
  base64: string;
}

export async function extractPdfAsImages(
  file: File,
  maxPages = 15,
  onProgress?: (done: number, total: number) => void,
): Promise<PageImage[]> {
  await import("./map-polyfill");
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const total = Math.min(pdf.numPages, maxPages);
  const images: PageImage[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذّر إنشاء لوحة الرسم");
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    images.push({ page: i, dataUrl, base64: dataUrl.split(",")[1] });
    onProgress?.(i, total);
  }

  return images;
}

/** Run tasks with a bounded concurrency. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}
