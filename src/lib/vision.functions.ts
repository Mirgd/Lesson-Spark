import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAiGateway } from "@/lib/ai-gateway.server";
import { langInstruction } from "@/lib/lang";

const Input = z.object({
  imageBase64: z.string(),
  pageNumber: z.number(),
  topic: z.string(),
  subject: z.string(),
  lang: z.enum(["ar", "en"]).default("ar"),
});

const PHASES = ["engage", "explore", "explain", "elaborate", "evaluate"] as const;
type Phase = (typeof PHASES)[number];

export const analyzePageForPhase = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
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
                image_url: { url: `data:image/jpeg;base64,${data.imageBase64}` },
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
      const phase = String(parsed.bestPhase ?? "explain") as Phase;
      return {
        pageNumber: data.pageNumber,
        pageContent: String(parsed.pageContent ?? ""),
        bestPhase: PHASES.includes(phase) ? phase : ("explain" as Phase),
        reasonAr: String(parsed.reasonAr ?? ""),
        slideTitle: String(parsed.slideTitle ?? `صفحة ${data.pageNumber}`),
        keyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.filter((p): p is string => typeof p === "string").slice(0, 5)
          : [],
        studentQuestion: String(parsed.studentQuestion ?? ""),
        hasActivity: Boolean(parsed.hasActivity),
        hasDiagram: Boolean(parsed.hasDiagram),
        ok: true as const,
      };
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

/* ---------- وصف صفحة الكتاب بكلمات بحث إنجليزية ---------- */

const DescribeInput = z.object({
  imageBase64: z.string().optional(),
  topic: z.string().optional(),
  subject: z.string().optional(),
});

export const describePageKeywords = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => DescribeInput.parse(data))
  .handler(async ({ data }): Promise<{ keywords: string }> => {
    const content: Array<Record<string, unknown>> = [];
    if (data.imageBase64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${data.imageBase64}` },
      });
      content.push({
        type: "text",
        text: `صف محتوى هذه الصفحة من الكتاب المدرسي في 3 كلمات إنجليزية فقط مناسبة للبحث عن صور علمية تعليمية مشابهة. أجب بالكلمات الإنجليزية فقط بدون أي إضافة.`,
      });
    } else {
      content.push({
        type: "text",
        text: `موضوع الدرس: "${data.topic ?? ""}" في مادة "${data.subject ?? ""}".
اكتب 3 كلمات إنجليزية فقط مناسبة للبحث عن صور علمية تعليمية عن هذا الموضوع.
أجب بالكلمات الإنجليزية فقط بدون أي إضافة.`,
      });
    }

    const raw = (await callAiGateway({ messages: [{ role: "user", content }], maxTokens: 60 })).trim();

    const keywords = raw.replace(/["`\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    return { keywords: keywords || (data.topic ?? "science lesson") };
  });
