import { useState } from "react";
import { FEEDBACK_OPTIONS, useQuestionFeedback, type WorksheetItem } from "@/lib/worksheet";

const TEAL = "#1E7CA8";

/**
 * Student-facing question list with instant correction:
 * the student writes an answer, reveals the model answer, then picks a feedback option.
 */
export function WorksheetQuestions({ item }: { item: WorksheetItem }) {
  const [feedback, setFeedback] = useQuestionFeedback();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const questions = item.questions.filter(Boolean);

  return (
    <ul className="space-y-3">
      {questions.map((q, qi) => {
        const key = `s${item.slideIndex}q${qi}`;
        const model = item.answers?.[qi] ?? "";
        const isOpen = Boolean(revealed[qi]);
        const chosen = feedback[key];
        return (
          <li key={qi} className="rounded-lg border bg-card p-2 text-sm">
            <div className="font-bold">
              {qi + 1}. {q}
            </div>

            <textarea
              value={drafts[qi] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [qi]: e.target.value }))}
              rows={2}
              placeholder="اكتب إجابتك هنا..."
              className="mt-2 w-full rounded border p-2 text-sm"
            />

            <button
              type="button"
              onClick={() => setRevealed((r) => ({ ...r, [qi]: !r[qi] }))}
              className="mt-2 rounded-md px-3 py-1 text-xs font-bold text-white"
              style={{ background: TEAL }}
            >
              {isOpen ? "أخفِ الإجابة النموذجية" : "🔍 صحّح إجابتي"}
            </button>

            {isOpen && (
              <div className="mt-2 space-y-2">
                <div
                  className="rounded-md p-2 text-sm leading-relaxed"
                  style={{ background: "#16794A14", borderInlineStart: "3px solid #16794A" }}
                >
                  <span className="font-bold" style={{ color: "#16794A" }}>
                    الإجابة النموذجية:{" "}
                  </span>
                  {model || "—"}
                </div>

                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_OPTIONS.map((opt) => {
                    const active = chosen === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFeedback(key, opt.value)}
                        className="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
                        style={{
                          borderColor: opt.color,
                          background: active ? opt.color : "transparent",
                          color: active ? "#fff" : opt.color,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {chosen === "partial" && (
                  <p className="text-xs text-muted-foreground">
                    أضف مثالاً أو سبباً من الشريحة ليكتمل جوابك.
                  </p>
                )}
                {chosen === "unclear" && (
                  <p className="text-xs text-muted-foreground">
                    ارفع يدك — سيعيد المعلم شرح هذه النقطة قبل الانتقال.
                  </p>
                )}
                {chosen === "correct" && (
                  <p className="text-xs font-bold" style={{ color: "#16794A" }}>
                    أحسنت! انتقل إلى السؤال التالي.
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
