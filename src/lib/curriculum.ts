// Browser-only extractors for PDF/DOCX/TXT/MD curriculum text.

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(
          new Error(
            "Unable to read file as ArrayBuffer",
          ),
        );
      }
    };

    reader.onerror = () => {
      reject(
        reader.error ??
          new Error("Unable to read file"),
      );
    };

    reader.onabort = () => {
      reject(
        new Error("File reading was cancelled"),
      );
    };

    reader.readAsArrayBuffer(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(
        typeof reader.result === "string"
          ? reader.result
          : "",
      );
    };

    reader.onerror = () => {
      reject(
        reader.error ??
          new Error("Unable to read text file"),
      );
    };

    reader.onabort = () => {
      reject(
        new Error("File reading was cancelled"),
      );
    };

    reader.readAsText(file);
  });
}

export async function extractText(
  file: File,
): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    return extractPdf(file);
  }

  if (name.endsWith(".docx")) {
    return extractDocx(file);
  }

  if (
    name.endsWith(".txt") ||
    name.endsWith(".md")
  ) {
    const text =
      await readFileAsText(file);

    return text.trim();
  }

  throw new Error(
    "صيغة غير مدعومة — استخدم PDF أو DOCX أو TXT أو MD",
  );
}

async function extractPdf(
  file: File,
): Promise<string> {
  await import("./map-polyfill");

  const pdfjs =
    await import("pdfjs-dist");

  const workerUrl = (
    await import(
      "pdfjs-dist/build/pdf.worker.min.mjs?url"
    )
  ).default;

  pdfjs.GlobalWorkerOptions.workerSrc =
    workerUrl;

  const buffer =
    await readFileAsArrayBuffer(file);

  const doc =
    await pdfjs.getDocument({
      data: new Uint8Array(buffer),
    }).promise;

  const parts: string[] = [];

  const maxPages =
    Math.min(doc.numPages, 50);

  for (
    let i = 1;
    i <= maxPages;
    i++
  ) {
    const page =
      await doc.getPage(i);

    const content =
      await page.getTextContent();

    const text = content.items
      .map((item) => {
        if (
          typeof item === "object" &&
          item !== null &&
          "str" in item
        ) {
          return String(
            (
              item as {
                str?: unknown;
              }
            ).str ?? "",
          );
        }

        return "";
      })
      .join(" ");

    parts.push(text);

    page.cleanup();
  }

  return parts
    .join("\n\n")
    .trim();
}

async function extractDocx(
  file: File,
): Promise<string> {
  const mammoth =
    await import("mammoth");

  const buffer =
    await readFileAsArrayBuffer(file);

  const result =
    await mammoth.extractRawText({
      arrayBuffer: buffer,
    });

  return result.value.trim();
}