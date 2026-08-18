import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAiGateway, failParse } from "@/lib/ai-gateway.server";
import { langInstruction } from "@/lib/lang";

const Input = z.object({
  subject: z.string().default(""),
  grade: z.string().default(""),
  topic: z.string().default(""),
  outcomes: z.array(z.string()).max(20).default([]),
  slides: z
    .array(
      z.object({
        pageNumber: z.number().optional(),
        title: z.string().default(""),
        phase: z.string().default(""),
        points: z.array(z.string()).default([]),
        question: z.string().default(""),
      }),
    )
    .max(30)
    .default([]),
  /** أسئلة المراحل (ورقة العمل + بنك الأسئلة) */
  phaseQuestions: z
    .array(
      z.object({
        phase: z.string().default(""),
        text: z.string(),
        answer: z.string().default(""),
      }),
    )
    .max(40)
    .default([]),
  /** صور صفحات الكتاب (data URLs) — تُرسل للقراءة البصرية */
  images: z.array(z.string()).max(6).default([]),
  lang: z.enum(["ar", "en"]).default("ar"),
});

export interface AbsentHomework {
  summary: string;
  tasks: { phase: string; title: string; task: string; hint: string }[];
  selfCheck: string[];
  studentText: string;
  teacherNote: string;
}

export const generateAbsentHomework = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<AbsentHomework> => {
    const slidesText =
      data.slides
        .map(
          (s, i) =>
            `#${i + 1}${s.pageNumber ? ` (صفحة الكتاب ${s.pageNumber})` : ""} | المرحلة: ${
              s.phase
            } | ${s.title}\nالنقاط: ${s.points.filter(Boolean).join(" / ") || "—"}\nسؤال الشريحة: ${
              s.question || "—"
            }`,
        )
        .join("\n\n") || "لا توجد شرائح.";

    const questionsText =
      data.phaseQuestions
        .map((q) => `- [${q.phase}] ${q.text}${q.answer ? ` | الإجابة: ${q.answer}` : ""}`)
        .join("\n") || "لا توجد أسئلة.";

    const instruction = `أنت خبير تربوي. صمّم واجباً منزلياً تعويضياً لطالب غاب عن الحصة، بحيث يغطي نفس سياق صور الكتاب وأسئلة مراحل 5E التي دارت في الصف.

المادة: ${data.subject || "غير محدد"} | الصف: ${data.grade || "غير محدد"} | الموضوع: ${
      data.topic || "غير محدد"
    }
نواتج التعلم:
${data.outcomes.filter(Boolean).map((o) => `- ${o}`).join("\n") || "—"}

محتوى العرض المبني من صور الكتاب:
${slidesText}

أسئلة المراحل التي أُجيب عنها في الصف:
${questionsText}

${data.images.length ? "مرفق صور من صفحات الكتاب — استند إلى محتواها البصري (الأشكال، الجداول، التجارب) في صياغة المهام." : ""}

المطلوب:
- ملخص قصير للطالب الغائب يشرح ما فاته بلغته.
- مهمة واحدة لكل مرحلة من مراحل 5E ظهرت في الشرائح (المرحلة بالعربية)، مرتبطة بصفحة الكتاب أو الشكل المذكور، مع تلميح يساعده.
- 3 إلى 5 عبارات تحقق ذاتي تبدأ بـ "أستطيع أن...".
- نص الواجب النهائي بصياغة موجّهة للطالب، وملاحظة قصيرة للمعلم عن معيار التصحيح.

أجب بـ JSON فقط بدون أي نص خارجه:
{"summary":"...","tasks":[{"phase":"التهيئة","title":"...","task":"...","hint":"..."}],"selfCheck":["أستطيع أن ..."],"studentText":"...","teacherNote":"..."}

${langInstruction(data.lang)}`;

    const content: Record<string, unknown>[] = [{ type: "text", text: instruction }];
    for (const url of data.images) {
      content.push({ type: "image_url", image_url: { url } });
    }

    const raw = (await callAiGateway({ messages: [{ role: "user", content }] }))
      .replace(/```json|```/g, "")
      .trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0) failParse(raw);

    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<AbsentHomework>;
    const str = (v: unknown) => (typeof v === "string" ? v : "");

    return {
      summary: str(parsed.summary),
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks.slice(0, 8).map((t) => ({
            phase: str(t?.phase),
            title: str(t?.title),
            task: str(t?.task),
            hint: str(t?.hint),
          }))
        : [],
      selfCheck: Array.isArray(parsed.selfCheck)
        ? parsed.selfCheck.slice(0, 6).map((s) => str(s)).filter(Boolean)
        : [],
      studentText: str(parsed.studentText),
      teacherNote: str(parsed.teacherNote),
    };
  });
