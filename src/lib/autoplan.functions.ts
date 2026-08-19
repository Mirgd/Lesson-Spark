import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAiGateway, failParse } from "@/lib/ai-gateway.server";
import { repairJson } from "@/lib/autofill-json";
import { langInstruction } from "@/lib/lang";

const InfoInput = z.object({
  text: z.string(),
  firstPageImage: z.string().optional(),
  lang: z.enum(["ar", "en"]).default("ar"),
});

const PlanInput = z.object({
  text: z.string(),
  topic: z.string(),
  subject: z.string(),
  grade: z.string(),
  mainConcepts: z.array(z.string()).default([]),
  priorKnowledge: z.string().default(""),
  realWorldContext: z.string().default(""),
  lang: z.enum(["ar", "en"]).default("ar"),
});
const CompleteLessonInput = z.object({
  text: z.string(),
  firstPageImage: z.string().optional(),
  lang: z.enum(["ar", "en"]).default("ar"),
});

export interface LessonInfo {
  topic: string;
  subject: string;
  grade: string;
  unitTitle: string;
  outcomes: string[];
  keywords: string[];
  mainConcepts: string[];
  priorKnowledge: string;
  realWorldContext: string;
  objectives: string[];
}

type Content =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function callGateway(content: string | Content[], maxTokens: number) {
  return callAiGateway({ messages: [{ role: "user", content }], maxTokens });
}

function parseJson<T>(raw: string): T {
  const clean = raw.replace(/```json|```|'''json|'''/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // ناتج مقطوع بسبب حد الرموز — نُصلح الأقواس ثم نُحاول مرة أخرى
    return JSON.parse(repairJson(start >= 0 ? clean.slice(start) : clean)) as T;
  }
}


const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** الخطوة 2: استخراج كل معلومات الدرس من نص المقرر (+ صورة الصفحة الأولى إن وجدت) */
export const extractLessonInfo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InfoInput.parse(data))
  .handler(async ({ data }): Promise<LessonInfo> => {
    const instruction = `أنت خبير تربوي متخصص في تحليل المناهج الدراسية السعودية وبناء خطط الدروس وفق نموذج 5E والنظرية البنائية.

اقرأ هذا المقرر الدراسي واستخرج منه كل المعلومات التالية.

نص المقرر:
${data.text.slice(0, 5000)}

أجب بـ JSON فقط بهذا الشكل بدون أي نص خارجه:
{
  "topic": "عنوان الدرس أو الوحدة كما هو في الكتاب",
  "subject": "اسم المادة الدراسية",
  "grade": "الصف الدراسي",
  "unitTitle": "عنوان الوحدة الكبرى إن وجدت",
  "outcomes": ["أُعرّف ...","أُميّز ...","أُطبّق ...","أستنتج ...","أربط ..."],
  "keywords": ["مصطلح 1","مصطلح 2","مصطلح 3"],
  "mainConcepts": ["المفهوم الأول","المفهوم الثاني"],
  "priorKnowledge": "ما يجب أن يعرفه الطالب قبل هذا الدرس",
  "realWorldContext": "ارتباط الدرس بالحياة اليومية",
  "objectives": ["الهدف الأول","الهدف الثاني","الهدف الثالث"]
}

قواعد صياغة نواتج التعلم — مهمة جداً:
- صيغة المتكلم المفرد وفق النظرية البنائية
- ابدأ بفعل مضارع مباشر بهمزة المتكلم
- أمثلة صحيحة: أُعرّف، أُميّز، أُطبّق، أستنتج، أربط، أحلّل، أبني، أُصمّم
- لا تكتب "سأ..." ولا "يتوقع من الطالب..."
- كل ناتج محدد وقابل للقياس والملاحظة

${langInstruction(data.lang)}`;

    const content: Content[] = [];
    if (data.firstPageImage) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${data.firstPageImage}` },
      });
    }
    content.push({ type: "text", text: instruction });

    const raw = await callGateway(content, 3000);
    try {
      const p = parseJson<Record<string, unknown>>(raw);
      return {
        topic: str(p.topic),
        subject: str(p.subject),
        grade: str(p.grade),
        unitTitle: str(p.unitTitle),
        outcomes: strArr(p.outcomes),
        keywords: strArr(p.keywords),
        mainConcepts: strArr(p.mainConcepts),
        priorKnowledge: str(p.priorKnowledge),
        realWorldContext: str(p.realWorldContext),
        objectives: strArr(p.objectives),
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes("AI_ERR::")) throw e;
      failParse(raw);
    }
  });

export interface GeneratedPlan {
  engage: { teacher: string; student: string };
  explore: { teacher: string; student: string };
  explain: { teacher: string; student: string };
  elaborate: { teacher: string; student: string };
  evaluate: { teacher: string; student: string };
  homework: { teacher: string; student: string };
}
export interface CompleteLessonResult {
  topic: string;
  subject: string;
  grade: string;
  unitTitle: string;

  outcomes: string[];
  keywords: string[];
  mainConcepts: string[];

  priorKnowledge: string;
  realWorldContext: string;

  objectives: string[];

  engage: {
    teacher: string;
    student: string;
  };

  explore: {
    teacher: string;
    student: string;
  };

  explain: {
    teacher: string;
    student: string;
  };

  elaborate: {
    teacher: string;
    student: string;
  };

  evaluate: {
    teacher: string;
    student: string;
  };

  homework: {
    teacher: string;
    student: string;
  };
}
/** الخطوة 3: بناء خطة 5E كاملة من محتوى المقرر */
export const generateFullPlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PlanInput.parse(data))
  .handler(async ({ data }): Promise<GeneratedPlan> => {
    const prompt = `أنت خبير تربوي في تصميم دروس STEM وفق نموذج 5E.

موضوع الدرس: ${data.topic}
المادة: ${data.subject}
الصف: ${data.grade}
المفاهيم الرئيسية: ${data.mainConcepts.join("، ")}
المعرفة السابقة: ${data.priorKnowledge}
السياق الواقعي: ${data.realWorldContext}

نص المقرر:
${data.text.slice(0, 3000)}

صمّم خطة درس كاملة وفق نموذج 5E مدتها 60 دقيقة (55 دقيقة داخل الحصة + 5 دقائق للواجب) مبنية على محتوى هذا المقرر تحديداً.
كل ما يخص الطالب يُكتب بصيغة المتكلم المفرد (النظرية البنائية).

أجب بـ JSON فقط:
{
  "engage": { "teacher": "ما يفعله المعلم — 11 دقيقة", "student": "أُلاحظ... أتساءل... أتوقع..." },
  "explore": { "teacher": "ما يفعله المعلم — 16 دقيقة", "student": "أُجرّب... أُسجّل... أُقارن..." },
  "explain": { "teacher": "ما يفعله المعلم — 13 دقيقة", "student": "أُفسّر... أستنتج... أربط..." },
  "elaborate": { "teacher": "ما يفعله المعلم — 11 دقيقة", "student": "أُصمّم... أُطبّق... أبتكر..." },
  "evaluate": { "teacher": "ما يفعله المعلم — 5 دقائق", "student": "أُقيّم... أتأمل... أُجيب..." },
  "homework": { "teacher": "توجيه المعلم للواجب", "student": "تحدّيك المنزلي: تحدٍّ واقعي من محتوى الكتاب" }
}

${langInstruction(data.lang)}`;

    const raw = await callGateway(prompt, 6000);
    const pick = (v: unknown) => {
      const o = (v ?? {}) as Record<string, unknown>;
      return { teacher: str(o.teacher), student: str(o.student) };
    };
    try {
      const p = parseJson<Record<string, unknown>>(raw);
      return {
        engage: pick(p.engage),
        explore: pick(p.explore),
        explain: pick(p.explain),
        elaborate: pick(p.elaborate),
        evaluate: pick(p.evaluate),
        homework: pick(p.homework),
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes("AI_ERR::")) throw e;
      failParse(raw);
    }

  });
export const generateCompleteLesson = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    CompleteLessonInput.parse(data)
  )
  .handler(
    async ({ data }): Promise<CompleteLessonResult> => {
      const instruction = `
أنت خبير تربوي متخصص في تحليل المناهج وتصميم دروس STEM وفق نموذج 5E والنظرية البنائية.

حلّل محتوى المقرر التالي وأنشئ جميع بيانات الدرس في استجابة واحدة فقط.

نص المقرر:
${data.text.slice(0, 8000)}

المطلوب:

1. تحديد عنوان الدرس.
2. تحديد المادة.
3. تحديد الصف.
4. تحديد الوحدة.
5. استخراج نواتج التعلم.
6. تحديد الكلمات والمفاهيم الرئيسية.
7. تحديد المعرفة السابقة.
8. ربط الدرس بسياق من الحياة الواقعية.
9. كتابة أهداف الدرس.
10. بناء خطة 5E كاملة.
11. إنشاء واجب منزلي مرتبط بالدرس.

مدة الدرس:
55 دقيقة للحصة + 5 دقائق للواجب.

قواعد نواتج التعلم:
- بصيغة المتكلم المفرد.
- تبدأ بفعل مضارع قابل للقياس.
- أمثلة:
  أُعرّف
  أُميّز
  أُطبّق
  أستنتج
  أربط
  أحلّل
  أبني
- لا تستخدم "سأ".
- لا تستخدم "يتوقع من الطالب".

أجب بـ JSON فقط دون Markdown أو أي شرح خارجي:

{
  "topic": "عنوان الدرس",
  "subject": "المادة",
  "grade": "الصف",
  "unitTitle": "الوحدة",

  "outcomes": [
    "ناتج تعلم 1",
    "ناتج تعلم 2",
    "ناتج تعلم 3"
  ],

  "keywords": [
    "مصطلح 1",
    "مصطلح 2"
  ],

  "mainConcepts": [
    "مفهوم 1",
    "مفهوم 2"
  ],

  "priorKnowledge": "المعرفة السابقة",

  "realWorldContext": "ارتباط الدرس بالحياة الواقعية",

  "objectives": [
    "هدف 1",
    "هدف 2",
    "هدف 3"
  ],

  "engage": {
    "teacher": "دور المعلم — 11 دقيقة",
    "student": "دور الطالب"
  },

  "explore": {
    "teacher": "دور المعلم — 16 دقيقة",
    "student": "دور الطالب"
  },

  "explain": {
    "teacher": "دور المعلم — 13 دقيقة",
    "student": "دور الطالب"
  },

  "elaborate": {
    "teacher": "دور المعلم — 11 دقيقة",
    "student": "دور الطالب"
  },

  "evaluate": {
    "teacher": "دور المعلم — 5 دقائق",
    "student": "دور الطالب"
  },

  "homework": {
    "teacher": "توجيه المعلم",
    "student": "تحدٍ منزلي مرتبط بمحتوى الدرس"
  }
}

${langInstruction(data.lang)}
`;

      const content: Content[] = [];

      if (data.firstPageImage) {
        content.push({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${data.firstPageImage}`,
          },
        });
      }

      content.push({
        type: "text",
        text: instruction,
      });

      const raw = await callGateway(content, 7000);

      const pick = (v: unknown) => {
        const o = (v ?? {}) as Record<string, unknown>;

        return {
          teacher: str(o.teacher),
          student: str(o.student),
        };
      };

      try {
        const p =
          parseJson<Record<string, unknown>>(raw);

        return {
          topic: str(p.topic),
          subject: str(p.subject),
          grade: str(p.grade),
          unitTitle: str(p.unitTitle),

          outcomes: strArr(p.outcomes),
          keywords: strArr(p.keywords),
          mainConcepts: strArr(p.mainConcepts),

          priorKnowledge: str(p.priorKnowledge),
          realWorldContext: str(
            p.realWorldContext
          ),

          objectives: strArr(p.objectives),

          engage: pick(p.engage),
          explore: pick(p.explore),
          explain: pick(p.explain),
          elaborate: pick(p.elaborate),
          evaluate: pick(p.evaluate),
          homework: pick(p.homework),
        };
      } catch (e) {
        if (
          e instanceof Error &&
          e.message.includes("AI_ERR::")
        ) {
          throw e;
        }

        failParse(raw);
      }
    }
  );
/** قراءة بصرية للملفات المصوّرة: استخراج نص من صور الصفحات */
export const readTextFromImages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ images: z.array(z.string()).max(3) }).parse(data))
  .handler(async ({ data }): Promise<{ text: string }> => {
    if (data.images.length === 0) return { text: "" };
    const content: Content[] = data.images.map((b64) => ({
      type: "image_url" as const,
      image_url: { url: `data:image/jpeg;base64,${b64}` },
    }));
    content.push({
      type: "text",
      text: "هذه صفحات من كتاب مدرسي مصوّر. اكتب كل النص الظاهر فيها كما هو بالعربية، بدون أي تعليق أو تنسيق إضافي.",
    });
    const raw = await callGateway(content, 5000);
    return { text: raw };
  });
