import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAiGateway, failParse } from "@/lib/ai-gateway.server";
import { repairJson } from "@/lib/autofill-json";
import { langInstruction } from "@/lib/lang";

const Input = z.object({
  subject: z.string().default(""),
  grade: z.string().default(""),
  topic: z.string().min(1),
  objectives: z.string().default(""),
  curriculumText: z.string().default(""),
  lang: z.enum(["ar", "en"]).default("ar"),
});

export interface AutoFillPhase {
  teacherActivity: string;
  teacherQuestions: string;
  studentActivity: string;
}

export interface AutoFillResult {
  outcomes: string[];
  engage: AutoFillPhase;
  explore: AutoFillPhase;
  explain: AutoFillPhase;
  elaborate: AutoFillPhase;
  evaluate: AutoFillPhase;
  homework: { teacherNote: string; studentText: string };
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const phase = (v: unknown): AutoFillPhase => {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    teacherActivity: str(o.teacherActivity),
    teacherQuestions: str(o.teacherQuestions),
    studentActivity: str(o.studentActivity),
  };
};

export const autoFillLesson = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<AutoFillResult> => {
    const prompt = `أنت خبير تربوي في تصميم دروس STEM وفق نموذج 5E والنظرية البنائية.

المادة: ${data.subject || "غير محددة"}
الصف: ${data.grade || "غير محدد"}
موضوع الدرس: ${data.topic}
نواتج التعلم: ${data.objectives || "غير محددة بعد"}
${data.curriculumText ? `نص المقرر (اعتمد عليه تحديداً في كل التوليد):\n${data.curriculumText.slice(0, 3000)}` : ""}

أنشئ خطة درس كاملة وفق نموذج 5E لحصة 60 دقيقة (55 للمراحل + 5 للواجب).
لكل مرحلة: نشاط المعلم، أسئلة المعلم، نشاط الطالب.

قواعد الصياغة:
- نشاط المعلم: جمل إجرائية واضحة يبدأها بفعل
- أسئلة المعلم: 3 أسئلة مفتوحة تبدأ بـ ماذا/كيف/لماذا/ما
- نشاط الطالب: بصيغة المتكلم — أُجرّب، أُلاحظ، أستنتج، أُصمّم
- نواتج التعلم: فعل مضارع مباشر بصيغة المتكلم (أُعرّف، أُميّز، أُطبّق، أستنتج، أربط، أحلّل، أُصمّم، أبني)

أجب بـ JSON فقط بدون أي نص خارجه:
{"outcomes":["أُعرّف ...","أُميّز ...","أُطبّق ..."],
"engage":{"teacherActivity":"...","teacherQuestions":"• ...\\n• ...\\n• ...","studentActivity":"..."},
"explore":{"teacherActivity":"...","teacherQuestions":"• ...\\n• ...\\n• ...","studentActivity":"..."},
"explain":{"teacherActivity":"...","teacherQuestions":"• ...\\n• ...\\n• ...","studentActivity":"..."},
"elaborate":{"teacherActivity":"...","teacherQuestions":"• ...\\n• ...\\n• ...","studentActivity":"..."},
"evaluate":{"teacherActivity":"...","teacherQuestions":"• ...\\n• ...\\n• ...","studentActivity":"..."},
"homework":{"teacherNote":"...","studentText":"تحدّيك المنزلي: ..."}}

${langInstruction(data.lang)}`;

    const raw = await callAiGateway({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 8000,
    });
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    const candidate = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      const repaired = repairJson(start >= 0 ? clean.slice(start) : clean);
      try {
        parsed = JSON.parse(repaired) as Record<string, unknown>;
      } catch {
        failParse(raw);
      }
    }

    const hw = (parsed.homework ?? {}) as Record<string, unknown>;
    return {
      outcomes: Array.isArray(parsed.outcomes)
        ? parsed.outcomes.filter((o): o is string => typeof o === "string" && o.trim() !== "")
        : [],
      engage: phase(parsed.engage),
      explore: phase(parsed.explore),
      explain: phase(parsed.explain),
      elaborate: phase(parsed.elaborate),
      evaluate: phase(parsed.evaluate),
      homework: { teacherNote: str(hw.teacherNote), studentText: str(hw.studentText) },
    };
  });
