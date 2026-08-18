import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callGateway } from "../ai";

const PHASES = {
  engage: "التهيئة والاستثارة (Engage)",
  explore: "الاستكشاف (Explore)",
  explain: "الشرح والتفسير (Explain)",
  elaborate: "التوسع والإثراء (Elaborate)",
  evaluate: "التقويم (Evaluate)",
} as const;

export default defineTool({
  name: "suggest_phase_activity",
  title: "Suggest an activity for one 5E phase",
  description:
    "Suggest a hands-on classroom activity for a single phase of the 5E model, written twice: once as teacher instructions and once in direct student-facing Arabic.",
  inputSchema: {
    subject: z.string().min(1).describe("School subject."),
    grade: z.string().min(1).describe("Grade level."),
    topic: z.string().min(1).describe("Lesson topic."),
    phase: z
      .enum(["engage", "explore", "explain", "elaborate", "evaluate"])
      .describe("Which 5E phase the activity is for."),
    duration: z.number().int().min(1).max(60).describe("Phase length in minutes."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ subject, grade, topic, phase, duration }) => {
    const text = await callGateway(
      `أنت خبير تربوي في تعليم STEM متخصص في نموذج 5E. أجب بالعربية، 4-5 نقاط قصيرة قابلة للتنفيذ الفوري، بدون مقدمات ولا خواتيم.`,
      `المادة: ${subject} | الصف: ${grade}
الموضوع: ${topic}
المرحلة: ${PHASES[phase]} — ${duration} دقيقة

اقترح نشاطاً عملياً لهذه المرحلة.

أجب بهذا التنسيق حرفياً:
**للمعلم:**
- ...

**للطالب (صياغة مباشرة):**
- جرّب... / لاحظ... / فكّر...`,
    );
    return { content: [{ type: "text", text }] };
  },
});
