import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callGateway } from "../ai";

export default defineTool({
  name: "suggest_homework",
  title: "Suggest a home challenge",
  description:
    "Suggest an Extend-style home challenge for a lesson: a real-world task doable in 20-30 minutes that provokes thinking rather than memorization.",
  inputSchema: {
    subject: z.string().min(1).describe("School subject."),
    grade: z.string().min(1).describe("Grade level."),
    topic: z.string().min(1).describe("Lesson topic."),
    objectives: z.string().describe("Learning objectives. Pass an empty string if unknown."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ subject, grade, topic, objectives }) => {
    const text = await callGateway(
      `أنت خبير تربوي في تعليم STEM متخصص في نموذج 5E. أجب بالعربية بدون مقدمات ولا خواتيم.`,
      `المادة: ${subject} | الصف: ${grade}
الموضوع: ${topic}
نواتج التعلم: ${objectives || "غير محدد"}

اقترح واجباً منزلياً وفق مبدأ Extend:
- تحدٍّ واقعي يربط ما تعلمه الطالب بالحياة اليومية
- قابل للتنفيذ في 20-30 دقيقة
- يحفّز التفكير لا الحفظ

أجب بهذا التنسيق:
**توجيه المعلم:** ...
**للطالب:** تحدّيك المنزلي: ...`,
    );
    return { content: [{ type: "text", text }] };
  },
});
