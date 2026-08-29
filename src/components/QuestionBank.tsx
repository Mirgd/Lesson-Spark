import { useMemo, useState } from "react";
import {
  Star,
  Trash2,
  Plus,
  Library,
} from "lucide-react";
import {
  PHASES,
  type LessonPlan,
  type PhaseId,
} from "@/lib/lesson-types";
import {
  RATING_SCALE,
  useQuestionBank,
  type BankQuestion,
} from "@/lib/question-bank";
import { SharedFileBadge } from "@/components/SharedFileBadge";
import { useSharedFile } from "@/lib/pdf-images";

const TEAL = "#1E7CA8";

/* =========================================================
   RATING
========================================================= */

function Rating({
  value,
  onChange,
  isArabic,
}: {
  value: number;
  onChange: (v: number) => void;
  isArabic: boolean;
}) {
  const label = RATING_SCALE.find(
    (r) => r.value === value,
  );

  const englishRatingLabel = (
    ratingValue: number,
  ) => {
    switch (ratingValue) {
      case 1:
        return "Needs Improvement";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Very Good";
      case 5:
        return "Excellent";
      default:
        return "Not Rated";
    }
  };

  return (
    <div className="flex items-center gap-1">
      {RATING_SCALE.map((r) => (
        <button
          key={r.value}
          type="button"
          title={
            isArabic
              ? r.label
              : englishRatingLabel(r.value)
          }
          onClick={() =>
            onChange(
              value === r.value
                ? 0
                : r.value,
            )
          }
          className="transition-transform hover:scale-110"
        >
          <Star
            className="h-4 w-4"
            style={{
              color:
                r.value <= value
                  ? "#B8860B"
                  : "#C9CCD3",
              fill:
                r.value <= value
                  ? "#B8860B"
                  : "none",
            }}
          />
        </button>
      ))}

      <span
        className="ms-1 text-[11px]"
        style={{
          color:
            label?.color ??
            "#8A8F98",
        }}
      >
        {value
          ? isArabic
            ? label?.label
            : englishRatingLabel(value)
          : isArabic
            ? "بدون تقييم"
            : "Not Rated"}
      </span>
    </div>
  );
}

/* =========================================================
   QUESTION BANK
========================================================= */

export function QuestionBank({
  plan,
}: {
  plan: LessonPlan;
}) {
  const {
    items,
    addMany,
    update,
    remove,
  } = useQuestionBank();

  const isArabic =
    (plan.contentLanguage ?? "ar") ===
    "ar";

  const [tab, setTab] =
    useState<PhaseId>("engage");

  const [search, setSearch] =
    useState("");

  const [draft, setDraft] =
    useState({
      text: "",
      answer: "",
    });

  const { name: sharedName } =
    useSharedFile();

  /* =========================================================
     PHASE LABEL
  ========================================================= */

  const getPhaseName = (
    phaseId: PhaseId,
  ) => {
    const phase = PHASES.find(
      (p) => p.id === phaseId,
    );

    if (!phase) {
      return phaseId;
    }

    if (isArabic) {
      return phase.nameAr;
    }

    const names: Record<
      PhaseId,
      string
    > = {
      engage: "Engage",
      explore: "Explore",
      explain: "Explain",
      elaborate: "Elaborate",
      evaluate: "Evaluate",
    };

    return names[phaseId];
  };

  /* =========================================================
     FILTER QUESTIONS
  ========================================================= */

  const filtered = useMemo(() => {
    const q =
      search.trim().toLowerCase();

    return items
      .filter(
        (it) =>
          it.phase === tab,
      )
      .filter((it) => {
        if (!q) {
          return true;
        }

        return (
          it.text
            .toLowerCase()
            .includes(q) ||
          it.topic
            .toLowerCase()
            .includes(q)
        );
      })
      .sort(
        (a, b) =>
          b.rating - a.rating ||
          b.uses - a.uses,
      );
  }, [items, tab, search]);

  const selectedCount =
    items.filter(
      (i) => i.selected,
    ).length;

  /* =========================================================
     ADD QUESTION
  ========================================================= */

  const add = () => {
    if (!draft.text.trim()) {
      return;
    }

    addMany([
      {
        phase: tab,
        subject: plan.subject,
        topic: plan.topic,
        text: draft.text.trim(),
        answer:
          draft.answer.trim(),
      },
    ]);

    setDraft({
      text: "",
      answer: "",
    });
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div
      className="card-elevated p-4"
      dir={
        isArabic
          ? "rtl"
          : "ltr"
      }
    >
      <SharedFileBadge
        name={sharedName}
      />

      {/* HEADER */}

      <div className="mb-3 flex items-center justify-between gap-2">

        <div
          className="flex items-center gap-2 text-sm font-bold"
          style={{
            color: TEAL,
          }}
        >
          <Library className="h-4 w-4" />

          {isArabic
            ? "بنك الأسئلة"
            : "Question Bank"}
        </div>

        <span className="text-[11px] text-muted-foreground">
          {isArabic
            ? `${items.length} سؤال · ${selectedCount} مختار لورقة العمل`
            : `${items.length} ${
                items.length === 1
                  ? "Question"
                  : "Questions"
              } · ${selectedCount} Selected for Worksheet`}
        </span>

      </div>

      {/* =====================================================
          PHASE TABS
      ===================================================== */}

      <div className="flex flex-wrap gap-1">

        {PHASES.map((p) => {
          const count =
            items.filter(
              (i) =>
                i.phase === p.id,
            ).length;

          const active =
            tab === p.id;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                setTab(p.id)
              }
              className="rounded-full border px-3 py-1 text-xs font-bold transition-colors"
              style={{
                borderColor:
                  p.color,
                background:
                  active
                    ? p.color
                    : "transparent",
                color:
                  active
                    ? "#fff"
                    : p.color,
              }}
            >
              {getPhaseName(
                p.id,
              )}{" "}
              ({count})
            </button>
          );
        })}

      </div>

      {/* =====================================================
          SEARCH
      ===================================================== */}

      <input
        value={search}
        onChange={(e) =>
          setSearch(
            e.target.value,
          )
        }
        placeholder={
          isArabic
            ? "ابحث في أسئلة هذه المرحلة..."
            : "Search questions in this phase..."
        }
        className="mt-3 w-full rounded border p-2 text-sm"
      />

      {/* =====================================================
          SAVED QUESTIONS
      ===================================================== */}

      <ul className="mt-3 space-y-2">

        {filtered.length ===
          0 && (
          <li className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">

            {isArabic
              ? "لا توجد أسئلة محفوظة لهذه المرحلة — أضف سؤالاً أو ولّد ورقة عمل ليُحفظ تلقائياً."
              : "No saved questions for this phase — add a question or generate a worksheet to save them automatically."}

          </li>
        )}

        {filtered.map(
          (q: BankQuestion) => (
            <li
              key={q.id}
              className="rounded-lg border bg-card p-2"
            >

              <div className="flex items-start gap-2">

                {/* SELECT */}

                <input
                  type="checkbox"
                  checked={Boolean(
                    q.selected,
                  )}
                  onChange={() =>
                    update(q.id, {
                      selected:
                        !q.selected,
                    })
                  }
                  className="mt-1"
                  title={
                    isArabic
                      ? "أعد استخدامه في ورقة العمل القادمة"
                      : "Reuse in the next worksheet"
                  }
                />

                {/* QUESTION */}

                <div className="min-w-0 flex-1">

                  <textarea
                    value={q.text}
                    onChange={(e) =>
                      update(q.id, {
                        text:
                          e.target
                            .value,
                      })
                    }
                    rows={2}
                    className="w-full rounded border p-2 text-sm"
                  />

                  {/* MODEL ANSWER */}

                  <input
                    value={q.answer}
                    onChange={(e) =>
                      update(q.id, {
                        answer:
                          e.target
                            .value,
                      })
                    }
                    placeholder={
                      isArabic
                        ? "الإجابة النموذجية"
                        : "Model Answer"
                    }
                    className="mt-1 w-full rounded border p-2 text-sm"
                    style={{
                      background:
                        "#16794A0F",
                    }}
                  />

                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">

                    <Rating
                      value={
                        q.rating
                      }
                      onChange={(v) =>
                        update(
                          q.id,
                          {
                            rating:
                              v,
                          },
                        )
                      }
                      isArabic={
                        isArabic
                      }
                    />

                    <span className="text-[11px] text-muted-foreground">

                      {q.topic ||
                        "—"}

                      {" · "}

                      {isArabic
                        ? `استُخدم ${q.uses} مرة`
                        : `Used ${q.uses} ${
                            q.uses === 1
                              ? "time"
                              : "times"
                          }`}

                    </span>

                  </div>

                </div>

                {/* DELETE */}

                <button
                  type="button"
                  onClick={() =>
                    remove(q.id)
                  }
                  className="rounded p-1 text-muted-foreground hover:text-red-600"
                  title={
                    isArabic
                      ? "حذف"
                      : "Delete"
                  }
                  aria-label={
                    isArabic
                      ? "حذف السؤال"
                      : "Delete question"
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>

              </div>

            </li>
          ),
        )}

      </ul>

      {/* =====================================================
          ADD NEW QUESTION
      ===================================================== */}

      <div className="mt-3 rounded-lg border border-dashed p-2">

        <textarea
          value={draft.text}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              text:
                e.target.value,
            }))
          }
          rows={2}
          placeholder={
            isArabic
              ? "أضف سؤالاً جديداً لهذه المرحلة..."
              : "Add a new question for this phase..."
          }
          className="w-full rounded border p-2 text-sm"
        />

        <input
          value={draft.answer}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              answer:
                e.target.value,
            }))
          }
          placeholder={
            isArabic
              ? "الإجابة النموذجية (اختياري)"
              : "Model Answer (Optional)"
          }
          className="mt-1 w-full rounded border p-2 text-sm"
        />

        <button
          type="button"
          onClick={add}
          className="mt-2 flex items-center gap-1 rounded-md px-3 py-1 text-xs font-bold text-white"
          style={{
            background:
              TEAL,
          }}
        >
          <Plus className="h-3 w-3" />

          {isArabic
            ? "أضف إلى البنك"
            : "Add to Question Bank"}
        </button>

      </div>

      {/* =====================================================
          FOOTER NOTE
      ===================================================== */}

      <p className="mt-2 text-center text-xs text-muted-foreground">

        {isArabic
          ? "الأسئلة المختارة (☑) تُعاد داخل ورقة العمل القادمة لمراحلها المطابقة."
          : "Selected questions (☑) will be reused in the next worksheet for their matching phases."}

      </p>

    </div>
  );
}