import { callAiGateway, failParse } from "@/lib/ai-gateway.server";
import { langInstruction } from "@/lib/lang";

interface OutcomeInput {
  curriculum: string;
  topic: string;
  subject: string;
  grade: string;
  lang?: "ar" | "en";
}
export interface OutcomeResult {
  outcomes: string[];
  source: string;
}

/** لا يفشل أبداً: يجرّب JSON ثم regex ثم يستخدم النص الخام كقائمة نقاط. */
function parseOutcomes(raw: string): OutcomeResult | null {
  const clean = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  if (!clean) return null;
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const candidates = start >= 0 && end > start ? [clean.slice(start, end + 1), clean] : [clean];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { outcomes?: unknown; source?: unknown };
      const outcomes = Array.isArray(parsed.outcomes)
        ? parsed.outcomes
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item) => item.trim())
        : [];
      if (outcomes.length)
        return { outcomes, source: typeof parsed.source === "string" ? parsed.source.trim() : "" };
    } catch {
      /* use tolerant fallback */
    }
  }
  const array = clean.match(/"outcomes"\s*:\s*\[([\s\S]*?)(\]|$)/);
  if (array) {
    const outcomes = [...array[1].matchAll(/"([^"]{4,})"/g)].map((match) => match[1].trim());
    if (outcomes.length)
      return { outcomes, source: clean.match(/"source"\s*:\s*"([^"]*)"/)?.[1]?.trim() ?? "" };
  }
  const source = clean.match(/"source"\s*:\s*"([^"]*)"/)?.[1]?.trim() ?? "";
  const strip = (line: string) =>
    line
      .replace(/^[\s\-*•◦●\d.)+:]+/, "")
      .replace(/^["'“]|["'”],?$/g, "")
      .trim();
  const noise = (line: string) =>
    !line ||
    line.length < 5 ||
    /^[{}[\],]+$/.test(line) ||
    /^"?(outcomes|source)"?\s*:/i.test(line);

  // 1) أسطر النص
  const lines = clean
    .split(/\r?\n/)
    .map(strip)
    .filter((l) => !noise(l))
    .slice(0, 6);
  if (lines.length) return { outcomes: lines, source };

  // 2) جُمل داخل نص متصل
  const sentences = clean
    .split(/(?<=[.؟!،؛])\s+/)
    .map(strip)
    .filter((l) => !noise(l))
    .slice(0, 6);
  if (sentences.length) return { outcomes: sentences, source };

  // 3) آخر حل: النص كما هو ناتجاً واحداً
  return { outcomes: [clean.slice(0, 400)], source };
}

export async function extractOutcomesFromCurriculum(data: OutcomeInput): Promise<OutcomeResult> {
  const prompt = `أنت خبير تربوي متخصص في بناء نواتج التعلم وفق النظرية البنائية.
المادة: ${data.subject || "غير محدد"}\nالصف: ${data.grade || "غير محدد"}\nموضوع الدرس: ${data.topic}
نص المقرر:\n${data.curriculum.slice(0, 8000)}
استخرج 3 إلى 5 نواتج تعلم مرتبطة بالموضوع. اكتب كل ناتج بلسان الطالب وابدأ بفعل مضارع قابل للقياس مثل أُعرّف، أُميّز، أُطبّق، أستنتج، أحلّل، أربط، أبني. لا تستخدم "سأ".
أجب بـ JSON فقط: {"outcomes":["أُعرّف ...","أُميّز ...","أُطبّق ..."],"source":"الفقرة المصدر"}

${langInstruction(data.lang)}`;
  const raw = await callAiGateway({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 2500,
  });
  const parsed = parseOutcomes(raw);
  if (parsed) return parsed;
  failParse(raw);
}
