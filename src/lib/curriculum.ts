// Browser-only extractors for PDF/PPTX/DOCX/TXT/MD curriculum text.

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read file as ArrayBuffer"));
      }
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Unable to read file"));
    };

    reader.onabort = () => {
      reject(new Error("File reading was cancelled"));
    };

    reader.readAsArrayBuffer(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Unable to read text file"));
    };

    reader.onabort = () => {
      reject(new Error("File reading was cancelled"));
    };

    reader.readAsText(file);
  });
}

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    return extractPdf(file);
  }
  if (name.endsWith(".pptx")) {
    return extractPptx(file);
  }

  if (name.endsWith(".docx")) {
    return extractDocx(file);
  }

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const text = await readFileAsText(file);

    return text.trim();
  }

  throw new Error("صيغة غير مدعومة — استخدم PDF أو DOCX أو TXT أو MD");
}

async function extractPdf(file: File): Promise<string> {
  await import("./map-polyfill");

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;

  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await readFileAsArrayBuffer(file);

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
  }).promise;

  const parts: string[] = [];

  const maxPages = Math.min(doc.numPages, 50);

  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);

    const content = await page.getTextContent();

    const pageParts: string[] = [];

    for (const item of content.items) {
      if (typeof item === "object" && item !== null && "str" in item) {
        const value = (
          item as {
            str?: unknown;
          }
        ).str;

        if (typeof value === "string" && value.trim()) {
          pageParts.push(value);
        }
      }
    }

    parts.push(pageParts.join(" "));

    page.cleanup();
  }

  return parts.join("\n\n").trim();
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");

  const buffer = await readFileAsArrayBuffer(file);

  const result = await mammoth.extractRawText({
    arrayBuffer: buffer,
  });

  return result.value.trim();
}
async function extractPptx(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;

  const buffer = await readFileAsArrayBuffer(file);

  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const getNumber = (value: string) => {
        const match = value.match(/slide(\d+)\.xml$/);

        return match ? Number(match[1]) : 0;
      };

      return getNumber(a) - getNumber(b);
    });

  const slidesText: string[] = [];

  for (const slidePath of slideFiles) {
    const slideFile = zip.file(slidePath);

    if (!slideFile) {
      continue;
    }

    const xml = await slideFile.async("text");

    const parser = new DOMParser();
    const document = parser.parseFromString(xml, "application/xml");

    const textNodes = Array.from(document.getElementsByTagName("a:t"));

    const text = textNodes
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");

    if (text) {
      slidesText.push(text);
    }
  }

  return slidesText.join("\n\n").trim();
}
export interface PptxImage {
  name: string;
  base64: string;
  mimeType: string;
}

export async function extractPptxImages(file: File): Promise<PptxImage[]> {
  const JSZip = (await import("jszip")).default;

  const buffer = await readFileAsArrayBuffer(file);
  const zip = await JSZip.loadAsync(buffer);

  const mediaFiles = Object.keys(zip.files)
    .filter((name) => name.startsWith("ppt/media/"))
    .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name));

  const images: PptxImage[] = [];

  for (const path of mediaFiles) {
    const media = zip.file(path);

    if (!media) continue;

    const base64 = await media.async("base64");

    const extension = path.split(".").pop()?.toLowerCase() ?? "png";

    const mimeType =
      extension === "jpg" || extension === "jpeg"
        ? "image/jpeg"
        : extension === "webp"
          ? "image/webp"
          : "image/png";

    images.push({
      name: path.split("/").pop() ?? path,
      base64: `data:${mimeType};base64,${base64}`,
      mimeType,
    });
  }

  return images;
}
