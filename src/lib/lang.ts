/**
 * لغة محتوى الدرس — تتحكّم فقط في لغة المحتوى التعليمي المولَّد بالذكاء الاصطناعي.
 * واجهة التطبيق تبقى بالعربية و RTL دائماً.
 */
export type ContentLanguage = "ar" | "en";

export const CONTENT_LANGUAGES: { value: ContentLanguage; label: string }[] = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
];

/** أي قيمة غير معروفة (أو خطة قديمة بدون الحقل) تُعامل كعربية. */
export function normalizeLang(v: unknown): ContentLanguage {
  return v === "en" ? "en" : "ar";
}

const AR_INSTRUCTION = `تعليمات اللغة (إلزامية):
- اكتب كل المحتوى التعليمي بالعربية الفصيحة الواضحة المناسبة لعمر الطلاب.
- أسماء الحقول ومفاتيح JSON تبقى كما هي في القالب المطلوب.`;

const EN_INSTRUCTION = `LANGUAGE INSTRUCTIONS (MANDATORY):
- Write ALL educational content in natural, age-appropriate academic English.
- This includes the lesson topic/title, objectives, learning outcomes, teacher explanations, examples, questions, activities, student instructions, discussion prompts, assessments, model answers, key vocabulary, homework, worksheets, question-bank items, presentation slides and student-facing text.
- Do NOT write any Arabic in the content values, and do NOT translate or mix languages.
- Student-facing statements stay in first person (I observe..., I explain..., I design...).
- Keep the requested JSON keys and output format exactly as given in the template; only the values are in English.`;

/** الكتلة التي تُضاف إلى كل prompt لضبط لغة المحتوى المولَّد. */
export function langInstruction(lang: unknown): string {
  return normalizeLang(lang) === "en" ? EN_INSTRUCTION : AR_INSTRUCTION;
}
