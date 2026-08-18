import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callGateway } from "../ai";

export default defineTool({
  name: "plan_5e_lesson",
  title: "Plan a 5E lesson",
  description:
    "Generate a complete 60-minute STEM lesson plan following the 5E deep-learning model (Engage, Explore, Explain, Elaborate, Evaluate) in Arabic, with a teacher script and student-facing phrasing for each phase plus a homework challenge.",
  inputSchema: {
    subject: z.string().min(1).describe("School subject, e.g. 'العلوم'."),
    grade: z.string().min(1).describe("Grade level, e.g. 'الصف السادس الابتدائي'."),
    topic: z.string().min(1).describe("Lesson topic."),
    objectives: z
      .string()
      .describe("Learning objectives in the student's voice. Pass an empty string if unknown."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ subject, grade, topic, objectives }) => {
    const text = await callGateway(
      `أنت خبير تربوي في تعليم STEM متخصص في نموذج 5E للتعلم العميق. أجب بالعربية الفصيحة، بدون مقدمات ولا خواتيم.`,
      `المادة: ${subject}
الصف: ${grade}
الموضوع: ${topic}
نواتج التعلم: ${objectives || "غير محدد — اقترحها بنفسك بلسان الطالب"}

صمّم خطة درس كاملة لحصة 60 دقيقة (55 دقيقة داخل الحصة + 5 دقائق للواجب) وفق نموذج 5E بهذا التنسيق:

## نواتج التعلم (بلسان الطالب)
- ...

## Engage — التهيئة (10 دقائق)
**للمعلم:** ...
**للطالب:** ...

## Explore — الاستكشاف (16 دقيقة)
**للمعلم:** ...
**للطالب:** ...

## Explain — الشرح (13 دقيقة)
**للمعلم:** ...
**للطالب:** ...

## Elaborate — التوسع (11 دقيقة)
**للمعلم:** ...
**للطالب:** ...

## Evaluate — التقويم (5 دقائق)
**للمعلم:** ...
**للطالب:** ...

## الواجب المنزلي (Extend) — 5 دقائق
**للطالب:** تحدّيك المنزلي: ...`,
    );
    return { content: [{ type: "text", text }] };
  },
});
