import { callAiGateway, failParse } from "@/lib/ai-gateway.server";
import { repairJson } from "@/lib/autofill-json";
import { langInstruction } from "@/lib/lang";

export interface BankQ {
  text: string;
  answer: string;
  /** مستوى بلوم */
  level: string;
}
export type PhaseQuestions = Record<string, BankQ[]>;

const PHASE_KEYS = ["engage", "explore", "explain", "elaborate", "evaluate"] as const;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function parse(raw: string): PhaseQuestions | null {
  const clean = raw.replace(/```json|```|'''json|'''/gi, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    try {
      // قد ينتهي خرج النموذج بعد سؤال مكتمل وقبل إغلاق المصفوفات؛ احتفظ
      // بالأسئلة المكتملة وأغلق بنية JSON بدلاً من إسقاط خط المعالجة كله.
      parsed = JSON.parse(repairJson(start >= 0 ? clean.slice(start) : clean)) as Record<
        string,
        unknown
      >;
    } catch {
      return null;
    }
  }

  const out: PhaseQuestions = {};
  let count = 0;
  for (const key of PHASE_KEYS) {
    const list = Array.isArray(parsed[key]) ? (parsed[key] as unknown[]) : [];
    out[key] = list
      .map((item) => {
        const o = (item ?? {}) as Record<string, unknown>;
        return { text: str(o.question || o.text), answer: str(o.answer), level: str(o.level) };
      })
      .filter((q) => q.text.length > 3)
      .slice(0, 3);
    count += out[key].length;
  }
  return count ? out : null;
}

export async function buildPhaseQuestions(data: {
  text: string;
  topic: string;
  subject: string;
  grade: string;
  lang?: "ar" | "en";
}): Promise<PhaseQuestions> {
  const prompt = `أنت خبير تربوي في بناء الأسئلة الصفية وفق تصنيف بلوم ونموذج 5E.

المادة: ${data.subject || "غير محدد"} | الصف: ${data.grade || "غير محدد"}
موضوع الدرس: ${data.topic}
نص المقرر:
${data.text.slice(0, 5000)}

ولّد لكل مرحلة من مراحل 5E من سؤالين إلى ثلاثة أسئلة مبنية على محتوى هذا المقرر تحديداً، مع الإجابة النموذجية المختصرة، وفق مستويات بلوم التالية:
- engage (الإشراك): تذكر وفهم
- explore (الاستكشاف): تطبيق وتحليل
- explain (التفسير): فهم وتحليل
- elaborate (التوسيع): تركيب وتقويم
- evaluate (التقويم): تأمل ذاتي

أجب بـ JSON فقط بدون أي نص خارجه:
{
  "engage": [{"question":"...","answer":"...","level":"تذكر"}],
  "explore": [{"question":"...","answer":"...","level":"تطبيق"}],
  "explain": [{"question":"...","answer":"...","level":"فهم"}],
  "elaborate": [{"question":"...","answer":"...","level":"تركيب"}],
  "evaluate": [{"question":"...","answer":"...","level":"تأمل ذاتي"}]
}

مفاتيح JSON ومسميات المراحل تبقى كما هي.

${langInstruction(data.lang)}`;
  const raw = await callAiGateway({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 4000,
  });
  const parsed = parse(raw);
  if (parsed) return parsed;
  failParse(raw);
}
