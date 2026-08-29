import { useUiLanguage } from "@/lib/ui-language";
import { createFileRoute } from "@tanstack/react-router";
import { useCurrentPlan } from "@/lib/lesson-types";
import { PHASE_LABELS } from "@/lib/presentation";
import { useWorksheet } from "@/lib/worksheet";

export const Route = createFileRoute("/worksheet")({
  head: () => ({
    meta: [
      { title: "ورقة عمل الطالب — المدرسة الرمز · التعلم العميق" },
      {
        name: "description",
        content: "ورقة عمل مرتبطة بشرائح الدرس: أسئلة قصيرة وتحقق ذاتي وفق نموذج 5E.",
      },
      { property: "og:title", content: "ورقة عمل الطالب — التعلم العميق" },
      {
        property: "og:description",
        content: "أسئلة قصيرة وتحقق ذاتي لكل شريحة من شرائح الدرس.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorksheetPage,
});

function WorksheetPage() {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const [items] = useWorksheet();
  const [plan] = useCurrentPlan();

  const phaseName = (phase: keyof typeof PHASE_LABELS) => {
    if (isArabic) {
      return PHASE_LABELS[phase]?.ar ?? phase;
    }

    const names: Record<string, string> = {
      engage: "Engage",
      explore: "Explore",
      explain: "Explain",
      elaborate: "Elaborate",
      evaluate: "Evaluate",
      homework: "Homework",
    };

    return names[phase] ?? phase;
  };

  if (items.length === 0) {
    return (
      <main
        dir={isArabic ? "rtl" : "ltr"}
        className="grid min-h-screen place-items-center p-8 text-center"
      >
        <p className="text-muted-foreground">
          {isArabic
            ? "لا توجد ورقة عمل — ولّدها من صفحة التخطيط."
            : "No worksheet is available — generate one from the Planning page."}
        </p>
      </main>
    );
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0"
    >
      <header className="mb-6 border-b-2 pb-3" style={{ borderColor: "#B8860B" }}>
        <h1 className="text-2xl font-black" style={{ color: "#1B2A4A" }}>
          {isArabic
            ? `ورقة عمل الطالب — ${plan.topic || "درس اليوم"}`
            : `Student Worksheet — ${plan.topic || "Today's Lesson"}`}
        </h1>

        <p className="mt-1 text-sm text-neutral-600">
          {plan.subject || "—"} · {plan.grade || "—"} · {isArabic ? "الاسم:" : "Name:"}{" "}
          ..............................
        </p>
      </header>

      {plan.outcomes && plan.outcomes.length > 0 && (
        <section className="mb-6 rounded-lg p-4" style={{ background: "#B8860B14" }}>
          <h2 className="mb-2 text-base font-black" style={{ color: "#1B2A4A" }}>
            {isArabic ? "ماذا سأتعلم اليوم؟" : "What Will I Learn Today?"}
          </h2>

          <ul className="space-y-1 text-sm">
            {plan.outcomes.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>
        </section>
      )}

      <ol className="space-y-5">
        {items.map((it, i) => (
          <li key={i} className="break-inside-avoid rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-[11px] font-bold text-white"
                style={{
                  background: PHASE_LABELS[it.phase as keyof typeof PHASE_LABELS]?.color ?? "#888",
                }}
              >
                {phaseName(it.phase as keyof typeof PHASE_LABELS)}
              </span>

              <h2 className="text-base font-bold" style={{ color: "#1B2A4A" }}>
                {i + 1}. {it.slideTitle}
              </h2>
            </div>

            <ul className="space-y-3">
              {it.questions.filter(Boolean).map((q, qi) => (
                <li key={qi}>
                  <div className="text-sm">• {q}</div>

                  <div className="mt-1 border-b border-dashed border-neutral-400" />
                </li>
              ))}
            </ul>

            <div className="mt-3 rounded p-2 text-sm" style={{ background: "#B8860B18" }}>
              ☐ {it.selfCheck}
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-10 break-before-page">
        <h2
          className="mb-3 border-b-2 pb-2 text-xl font-black"
          style={{
            borderColor: "#B8860B",
            color: "#1B2A4A",
          }}
        >
          {isArabic ? "مفتاح الإجابات النموذجية (للمعلم)" : "Model Answer Key (Teacher Copy)"}
        </h2>

        <ol className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="break-inside-avoid text-sm">
              <div className="font-bold" style={{ color: "#1B2A4A" }}>
                {i + 1}. {it.slideTitle}
              </div>

              <ul className="mt-1 space-y-1">
                {it.questions.filter(Boolean).map((q, qi) => (
                  <li key={qi}>
                    • {q} — <span className="font-bold">{it.answers?.[qi] || "—"}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <button
        onClick={() => window.print()}
        className="mt-6 rounded-lg px-4 py-2 text-sm font-bold text-white print:hidden"
        style={{ background: "#1E7CA8" }}
      >
        {isArabic ? "🖨 طباعة" : "🖨 Print"}
      </button>
    </main>
  );
}
