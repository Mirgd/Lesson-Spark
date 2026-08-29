import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAiGateway } from "@/lib/ai-gateway.server";
import { langInstruction } from "@/lib/lang";

const Lang = z.enum(["ar", "en"]).default("ar");

const Input = z.object({
  subject: z.string(),
  grade: z.string(),
  topic: z.string(),
  objectives: z.string(),
  phaseNameAr: z.string(),
  phaseNameEn: z.string(),
  duration: z.number(),
  curriculum: z.string().optional(),
  lang: Lang,
});

const HomeworkInput = z.object({
  subject: z.string(),
  grade: z.string(),
  topic: z.string(),
  objectives: z.string(),
  curriculum: z.string().optional(),
  lang: Lang,
});

async function callGateway(system: string, user: string) {
  return callAiGateway({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
}

function systemPrompt(curriculum: string | undefined, lang: "ar" | "en") {
  const cur = (curriculum ?? "").slice(0, 8000).trim();
  return `أنت خبير تربوي في تعليم STEM متخصص في نموذج 5E للتعلم العميق.
${cur ? `المقرر الدراسي المرفوع:\n---\n${cur}\n---\nاستخدم مصطلحات هذا المقرر ومفاهيمه تحديداً في اقتراحاتك.` : ""}
قواعد الإجابة:
- 4-5 نقاط قصيرة قابلة للتنفيذ الفوري
- لا مقدمات ولا خواتيم
- قسمين بالضبط: **للمعلم:** ثم **للطالب (صياغة مباشرة):**
(احتفظ بعناوين القسمين كما هي بالعربية)

${langInstruction(lang)}`;
}

export const suggestActivity = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const user = `المادة: ${data.subject || "غير محدد"} | الصف: ${data.grade || "غير محدد"}
الموضوع: ${data.topic || "غير محدد"}
نواتج التعلم: ${data.objectives || "غير محدد"}
المرحلة: ${data.phaseNameAr} (${data.phaseNameEn}) — ${data.duration} دقيقة

اقترح نشاطاً عملياً لهذه المرحلة وفق نموذج 5E.

أجب بالتنسيق التالي حرفياً:
**للمعلم:**
- ...

**للطالب (صياغة مباشرة):**
- جرّب... / لاحظ... / فكّر...`;
    return { text: await callGateway(systemPrompt(data.curriculum, data.lang), user) };
  });

export const suggestHomework = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => HomeworkInput.parse(data))
  .handler(async ({ data }) => {
    const user = `المادة: ${data.subject || "غير محدد"} | الصف: ${data.grade || "غير محدد"}
الموضوع: ${data.topic || "غير محدد"}
نواتج التعلم: ${data.objectives || "غير محدد"}

اقترح واجباً منزلياً وفق مبدأ Extend في 5E:
- تحدٍّ واقعي يربط ما تعلمه الطالب بالحياة اليومية
- قابل للتنفيذ في 20-30 دقيقة
- يحفّز التفكير لا الحفظ

أجب بالتنسيق التالي:
**توجيه المعلم:** ...
**للطالب:** تحدّيك المنزلي: ...`;
    return { text: await callGateway(systemPrompt(data.curriculum, data.lang), user) };
  });
