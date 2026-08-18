/**
 * تمثيل موحّد لأخطاء نداءات الذكاء الاصطناعي بين الخادم والواجهة.
 * الخادم يرمي خطأً مُرمّزاً بهذا الشكل، والواجهة تفكّه لتعرض رسالة عربية مفهومة
 * وتسجّل رمز الحالة ونص الاستجابة كاملاً في الكونسول.
 */

const PREFIX = "AI_ERR::";

export interface AiErrorInfo {
  /** رمز حالة HTTP الحقيقي القادم من الخادم أو من المزوّد */
  status: number;
  /** رسالة عربية مفهومة تصف ما حدث وما يفعله المستخدم */
  message: string;
  /** نص الاستجابة الخام (للكونسول فقط) */
  detail: string;
}

export function encodeAiError(info: AiErrorInfo): string {
  return (
    PREFIX +
    JSON.stringify({
      status: info.status,
      message: info.message,
      detail: (info.detail ?? "").slice(0, 2000),
    })
  );
}

export function decodeAiError(raw: string): AiErrorInfo | null {
  const at = raw.indexOf(PREFIX);
  if (at < 0) return null;
  try {
    const parsed = JSON.parse(raw.slice(at + PREFIX.length)) as Partial<AiErrorInfo>;
    return {
      status: Number(parsed.status ?? 0),
      message: String(parsed.message ?? ""),
      detail: String(parsed.detail ?? ""),
    };
  } catch {
    return null;
  }
}

/**
 * تُستخدم في كل `catch` حول نداء ذكاء اصطناعي:
 * تسجّل التفاصيل الكاملة في الكونسول وتعيد رسالة عربية للعرض على المستخدم.
 */
export function reportAiError(error: unknown, label: string, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const info = decodeAiError(raw);

  if (info) {
    console.error(
      `[AI] فشل «${label}» — رمز الحالة: ${info.status}\nالرسالة: ${info.message}\nنص الاستجابة:\n${
        info.detail || "(فارغ)"
      }`,
      error,
    );
    return info.message || fallback;
  }

  console.error(`[AI] فشل «${label}» — خطأ غير متوقع:\n${raw}`, error);
  return raw && !raw.startsWith("[object") ? raw : fallback;
}
