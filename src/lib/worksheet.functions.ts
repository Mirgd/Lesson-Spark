import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAiGateway, failParse } from "@/lib/ai-gateway.server";
import { langInstruction } from "@/lib/lang";

const Input = z.object({
  subject: z.string(),
  grade: z.string(),
  topic: z.string(),
  slides: z
    .array(
      z.object({
        slideIndex: z.number(),
        title: z.string(),
        phase: z.string(),
        points: z.array(z.string()).default([]),
        question: z.string().default(""),
      }),
    )
    .max(30),
  /** أسئلة معاد استخدامها من بنك الأسئلة */
  reuse: z
    .array(z.object({ phase: z.string(), text: z.string(), answer: z.string().default("") }))
    .max(30)
    .default([]),
  lang: z.enum(["ar", "en"]).default("ar"),
});

export const generateWorksheet = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const slidesText = data.slides
      .map(
        (s) =>
          `#${s.slideIndex} | المرحلة: ${s.phase} | العنوان: ${s.title}\nالنقاط: ${
            s.points.filter(Boolean).join(" / ") || "—"
          }\nسؤال العرض: ${s.question || "—"}`,
      )
      .join("\n\n");

    const reuseText = data.reuse.length
      ? `\n\nأسئلة من بنك أسئلة المعلم — أعد استخدامها كما هي في شرائح مراحلها المطابقة (لا تُعد صياغتها):\n${data.reuse
          .map((r) => `- [${r.phase}] ${r.text}${r.answer ? ` | الإجابة: ${r.answer}` : ""}`)
          .join("\n")}`
      : "";

    const instruction = `أنت خبير تربوي في تصميم أوراق عمل الطلاب وفق نموذج 5E.
المادة: ${data.subject || "غير محدد"} | الصف: ${data.grade || "غير محدد"} | الموضوع: ${data.topic || "غير محدد"}

شرائح العرض:
${slidesText}${reuseText}


لكل شريحة اكتب:
- سؤالين قصيرين جداً بلغة الطالب (إجابة كل سؤال سطر واحد)
- إجابة نموذجية قصيرة لكل سؤال بنفس الترتيب (جملة واحدة واضحة مستمدة من محتوى الشريحة)
- عبارة تحقق ذاتي تبدأ بـ "أستطيع أن..."

أجب بـ JSON فقط بدون أي نص خارجه:
{"items":[{"slideIndex":0,"questions":["...","..."],"answers":["...","..."],"selfCheck":"أستطيع أن ..."}]}

${langInstruction(data.lang)}`;

    const clean = (await callAiGateway({ messages: [{ role: "user", content: instruction }] }))
      .replace(/```json|```/g, "")
      .trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");

    let parsedItems: {
      slideIndex: number;
      questions: string[];
      answers: string[];
      selfCheck: string;
    }[] = [];
    try {
      const parsed = JSON.parse(
        start >= 0 && end > start ? clean.slice(start, end + 1) : clean,
      ) as { items?: unknown };
      if (Array.isArray(parsed.items)) {
        parsedItems = parsed.items.map((raw) => {
          const it = raw as Record<string, unknown>;
          return {
            slideIndex: Number(it.slideIndex ?? -1),
            questions: Array.isArray(it.questions)
              ? it.questions.filter((q): q is string => typeof q === "string").slice(0, 3)
              : [],
            answers: Array.isArray(it.answers)
              ? it.answers.filter((a): a is string => typeof a === "string").slice(0, 3)
              : [],
            selfCheck: String(it.selfCheck ?? ""),
          };
        });
      }
    } catch {
      failParse(clean);
    }

    // Always return one entry per requested slide so the worksheet stays aligned.
    const items = data.slides.map((s) => {
      const found = parsedItems.find((p) => p.slideIndex === s.slideIndex);
      const questions = found?.questions.filter(Boolean).length
        ? found.questions.filter(Boolean)
        : [s.question || "ماذا فهمت من هذه الشريحة؟"];
      const fallbackAnswer =
        s.points.filter(Boolean)[0] || s.title || "راجع محتوى الشريحة مع معلمك.";
      const answers = questions.map(
        (_q, qi) => (found?.answers?.[qi] || "").trim() || fallbackAnswer,
      );
      return {
        slideIndex: s.slideIndex,
        slideTitle: s.title,
        phase: s.phase,
        questions,
        answers,
        selfCheck: found?.selfCheck || `أستطيع أن أشرح: ${s.title}`,
      };
    });

    // Guarantee every reused bank question lands on a slide of its phase.
    const usedReuse = new Set<string>();
    for (const r of data.reuse) {
      const target = items.find((it) => it.phase === r.phase && !usedReuse.has(`${it.slideIndex}`));
      if (!target) continue;
      usedReuse.add(`${target.slideIndex}`);
      if (!target.questions.some((q) => q.trim() === r.text.trim())) {
        target.questions = [r.text, ...target.questions].slice(0, 4);
        target.answers = [r.answer || "راجع محتوى الشريحة.", ...target.answers].slice(0, 4);
      }
    }

    return { items };
  });
