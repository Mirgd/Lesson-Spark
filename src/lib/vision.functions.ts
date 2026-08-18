import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAiGateway } from "@/lib/ai-gateway.server";
import { langInstruction } from "@/lib/lang";

const PHASES = ["engage", "explore", "explain", "elaborate", "evaluate"] as const;
type Phase = (typeof PHASES)[number];

const SingleInput = z.object({
  imageBase64: z.string(),
  pageNumber: z.number(),
  topic: z.string(),
  subject: z.string(),
  lang: z.enum(["ar", "en"]).default("ar"),
});

const BatchInput = z.object({
  pages: z
    .array(
      z.object({
        imageBase64: z.string(),
        pageNumber: z.number(),
      }),
    )
    .min(1)
    .max(3),
  topic: z.string(),
  subject: z.string(),
  lang: z.enum(["ar", "en"]).default("ar"),
});

function normalizePageResult(parsed: Record<string, unknown>, pageNumber: number) {
  const phase = String(parsed.bestPhase ?? "explain") as Phase;

  return {
    pageNumber,
    pageContent: String(parsed.pageContent ?? ""),
    bestPhase: PHASES.includes(phase) ? phase : ("explain" as Phase),
    reasonAr: String(parsed.reasonAr ?? ""),
    slideTitle: String(parsed.slideTitle ?? `صفحة ${pageNumber}`),
    keyPoints: Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints
          .filter((p): p is string => typeof p === "string")
          .slice(0, 5)
      : [],
    studentQuestion: String(parsed.studentQuestion ?? ""),
    hasActivity: Boolean(parsed.hasActivity),
    hasDiagram: Boolean(parsed.hasDiagram),
    ok: true as const,
  };
}

export const analyzePageForPhase = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SingleInput.parse(data))
  .handler(async ({ data }) => {
    const instruction = `موضوع الدرس: ${data.topic || "غير محدد"}
المادة: ${data.subject || "غير محدد"}

اقرأ هذه الصفحة من الكتاب المدرسي وأجب بـ JSON فقط بدون أي نص خارجه:
{
  "pageContent": "وصف مختصر لمحتوى الصفحة في جملة واحدة",
  "bestPhase": "engage أو explore أو explain أو elaborate أو evaluate",
  "reasonAr": "لماذا تناسب هذه المرحلة؟ جملة واحدة",
  "slideTitle": "عنوان قصير للشريحة من محتوى الصفحة",
  "keyPoints": ["نقطة 1 بلغة الطالب", "نقطة 2", "نقطة 3"],
  "studentQuestion": "سؤال تفاعلي واحد للطالب من محتوى الصفحة",
  "hasActivity": true أو false,
  "hasDiagram": true أو false
}

قيمة bestPhase تبقى بالإنجليزية كما هي في القائمة أعلاه.

${langInstruction(data.lang)}`;

    const raw = (
      await callAiGateway({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${data.imageBase64}`,
                },
              },
              { type: "text", text: instruction },
            ],
          },
        ],
      })
    ).trim();

    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");

    try {
      const parsed = JSON.parse(
        start >= 0 && end > start ? clean.slice(start, end + 1) : clean,
      ) as Record<string, unknown>;

      return normalizePageResult(parsed, data.pageNumber);
    } catch (e) {
      if (e instanceof Error && e.message.includes("AI_ERR::")) throw e;

      return {
        pageNumber: data.pageNumber,
        pageContent: "",
        bestPhase: "explain" as Phase,
        reasonAr: "",
        slideTitle: `صفحة ${data.pageNumber}`,
        keyPoints: [] as string[],
        studentQuestion: "",
        hasActivity: false,
        hasDiagram: false,
        ok: false as const,
      };
    }
  });

export const analyzePagesForPhase = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => BatchInput.parse(data))
  .handler(async ({ data }) => {
    const instruction = `موضوع الدرس: ${data.topic || "غير محدد"}
المادة: ${data.subject || "غير محدد"}

ستجد عدة صفحات من الكتاب المدرسي، وكل صورة مرتبة حسب رقم الصفحة المرسل معها.

حلّل كل صفحة بشكل مستقل، وأجب بـ JSON ARRAY فقط، بدون أي نص خارجه.

أعد عنصراً واحداً لكل صفحة بنفس الترتيب، بهذا الشكل:

[
  {
    "pageNumber": 1,
    "pageContent": "وصف مختصر لمحتوى الصفحة",
    "bestPhase": "engage أو explore أو explain أو elaborate أو evaluate",
    "reasonAr": "لماذا تناسب هذه المرحلة؟",
    "slideTitle": "عنوان قصير للشريحة",
    "keyPoints": ["نقطة 1", "نقطة 2", "نقطة 3"],
    "studentQuestion": "سؤال تفاعلي",
    "hasActivity": true,
    "hasDiagram": false
  }
]

مهم:
- أعد نتيجة لكل صفحة.
- حافظ على pageNumber كما هو.
- bestPhase يجب أن تكون واحدة فقط من:
  engage, explore, explain, elaborate, evaluate
- لا تكتب Markdown.
- لا تكتب أي شيء خارج JSON array.

${langInstruction(data.lang)}`;

    const content: unknown[] = [];

    for (const page of data.pages) {
      content.push({
        type: "text",
        text: `PAGE_NUMBER: ${page.pageNumber}`,
      });

      content.push({
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${page.imageBase64}`,
        },
      });
    }

    content.push({
      type: "text",
      text: instruction,
    });

    const raw = (
      await callAiGateway({
        messages: [
          {
            role: "user",
            content,
          },
        ],
        maxTokens: 5000,
      })
    ).trim();

    const clean = raw.replace(/```json|```/g, "").trim();

    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");

    try {
      const parsed = JSON.parse(
        start >= 0 && end > start ? clean.slice(start, end + 1) : clean,
      ) as Record<string, unknown>[];

      const byPage = new Map<number, Record<string, unknown>>();

      for (const item of parsed) {
        const pageNumber = Number(item.pageNumber);

        if (Number.isInteger(pageNumber)) {
          byPage.set(pageNumber, item);
        }
      }

      return data.pages.map((page) => {
        const item = byPage.get(page.pageNumber);

        if (!item) {
          return {
            pageNumber: page.pageNumber,
            pageContent: "",
            bestPhase: "explain" as Phase,
            reasonAr: "",
            slideTitle: `صفحة ${page.pageNumber}`,
            keyPoints: [] as string[],
            studentQuestion: "",
            hasActivity: false,
            hasDiagram: false,
            ok: false as const,
          };
        }

        return normalizePageResult(item, page.pageNumber);
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("AI_ERR::")) throw e;

      return data.pages.map((page) => ({
        pageNumber: page.pageNumber,
        pageContent: "",
        bestPhase: "explain" as Phase,
        reasonAr: "",
        slideTitle: `صفحة ${page.pageNumber}`,
        keyPoints: [] as string[],
        studentQuestion: "",
        hasActivity: false,
        hasDiagram: false,
        ok: false as const,
      }));
    }
  });