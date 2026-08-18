import { createFileRoute } from "@tanstack/react-router";
import { PhaseImages } from "@/components/PhaseImages";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PHASES, phaseMeta, planLang, totalDuration, useCurrentPlan } from "@/lib/lesson-types";
import { getPageImage, usePresentation } from "@/lib/presentation";
import { useWorksheet } from "@/lib/worksheet";
import { loadBank } from "@/lib/question-bank";
import { useAbsentHomework } from "@/lib/absent-homework";
import { generateAbsentHomework } from "@/lib/homework.functions";
import { reportAiError } from "@/lib/ai-error";

export const Route = createFileRoute("/absent")({
  head: () => ({
    meta: [
      { title: "نسخة الطالب الغائب — المدرسة الرمز · التعلم العميق" },
      {
        name: "description",
        content:
          "نسخة مطبوعة شاملة للطالب الغائب: نواتج التعلم، مراحل 5E، محتوى الشرائح، ورقة العمل والإجابات النموذجية والواجب.",
      },
      { property: "og:title", content: "نسخة الطالب الغائب — التعلم العميق" },
      {
        property: "og:description",
        content: "كل ما فاتك في الحصة: الشرح، الأنشطة، الأسئلة، الإجابات النموذجية والواجب.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AbsentPage,
});

const NAVY = "#1B2A4A";
const GOLD = "#B8860B";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2
        className="mb-2 border-b-2 pb-1 text-lg font-black"
        style={{ borderColor: GOLD, color: NAVY }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function AbsentPage() {
  const [plan] = useCurrentPlan();
  const [slides] = usePresentation();
  const [worksheet] = useWorksheet();
  const [hw, setHw] = useAbsentHomework();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const genHomework = useServerFn(generateAbsentHomework);

  const phaseName = (id: string) => phaseMeta(id as never)?.nameAr ?? id;

  async function handleGenerate() {
    setBusy(true);
    setError("");
    try {
      // صور صفحات الكتاب المرتبطة بالشرائح (حتى ٦ صفحات)
      const pages = slides
        .map((s) => s.pageNumber)
        .filter((p): p is number => typeof p === "number");
      const uniquePages = Array.from(new Set(pages)).slice(0, 6);
      const images = (
        await Promise.all(uniquePages.map((p) => getPageImage(p).catch(() => null)))
      ).filter((v): v is string => Boolean(v));

      // أسئلة المراحل: ورقة العمل + بنك الأسئلة لنفس الموضوع
      const fromWorksheet = worksheet.flatMap((it) =>
        it.questions.filter(Boolean).map((q, qi) => ({
          phase: phaseName(it.phase),
          text: q,
          answer: it.answers?.[qi] ?? "",
        })),
      );
      const fromBank = loadBank()
        .filter((b) => !plan.topic || b.topic === plan.topic)
        .map((b) => ({ phase: phaseName(String(b.phase)), text: b.text, answer: b.answer }));
      const seen = new Set<string>();
      const phaseQuestions = [...fromWorksheet, ...fromBank]
        .filter((q) => {
          const k = q.text.replace(/\s+/g, " ").trim();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, 40);

      const result = await genHomework({
        data: {
          subject: plan.subject,
          grade: plan.grade,
          topic: plan.topic,
          lang: planLang(plan),
          outcomes: (plan.outcomes ?? []).filter(Boolean),
          slides: slides.slice(0, 30).map((s) => ({
            pageNumber: s.pageNumber,
            title: s.title ?? "",
            phase: phaseName(String(s.phase)),
            points: (s.points ?? []).filter(Boolean),
            question: s.question ?? "",
          })),
          phaseQuestions,
          images,
        },
      });
      setHw(result);
    } catch (e) {
      setError(reportAiError(e, "واجب الطالب الغائب", "تعذّر توليد الواجب."));
    } finally {
      setBusy(false);
    }
  }


  return (
    <main dir="rtl" className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <header className="border-b-2 pb-3" style={{ borderColor: GOLD }}>
        <h1 className="text-2xl font-black" style={{ color: NAVY }}>
          نسخة الطالب الغائب — {plan.topic || "درس اليوم"}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {plan.subject || "—"} · {plan.grade || "—"} · مدة الحصة {totalDuration(plan)} دقيقة ·
          الاسم: ..........................
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          هذه النسخة تحتوي كل ما دار في الحصة: النواتج، الأنشطة، محتوى العرض، الأسئلة مع الإجابات
          النموذجية، والواجب.
        </p>
      </header>

      {(plan.outcomes?.length ?? 0) > 0 && (
        <Section title="١. ماذا سأتعلم اليوم؟">
          <ul className="list-inside list-disc space-y-1 text-sm">
            {plan.outcomes!.filter(Boolean).map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="٢. مراحل الدرس (نموذج 5E)">
        <ol className="space-y-3">
          {plan.phases.map((ph) => {
            const meta = phaseMeta(ph.id) ?? PHASES.find((p) => p.id === ph.id)!;
            return (
              <li key={ph.id} className="break-inside-avoid rounded-lg border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="rounded px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ background: meta.color }}
                  >
                    {meta.nameAr} · {meta.nameEn}
                  </span>
                  <span className="text-[11px] text-neutral-500">{ph.duration} دقيقة</span>
                </div>
                <p className="text-sm">
                  <span className="font-bold">ما عليك فعله: </span>
                  {ph.studentActivity || meta.studentPrompt}
                </p>
                {ph.teacherActivity && (
                  <p className="mt-1 text-sm text-neutral-700">
                    <span className="font-bold">ما دار في الصف: </span>
                    {ph.teacherActivity}
                  </p>
                )}
                <PhaseImages images={ph.images} className="mt-2 print:grid-cols-3" />
              </li>

            );
          })}
        </ol>
      </Section>

      {slides.length > 0 && (
        <Section title="٣. محتوى العرض (الشرح كاملاً)">
          <ol className="space-y-3">
            {slides.map((s, i) => (
              <li key={s.id ?? i} className="break-inside-avoid rounded-lg border p-3">
                <div className="text-sm font-bold" style={{ color: NAVY }}>
                  {i + 1}. {s.title}
                </div>
                {(s.points?.filter(Boolean).length ?? 0) > 0 && (
                  <ul className="mt-1 list-inside list-disc text-sm">
                    {s.points!.filter(Boolean).map((p, pi) => (
                      <li key={pi}>{p}</li>
                    ))}
                  </ul>
                )}
                {s.question && (
                  <p className="mt-1 text-sm" style={{ color: GOLD }}>
                    سؤال الشريحة: {s.question}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {worksheet.length > 0 && (
        <Section title="٤. ورقة العمل مع الإجابات النموذجية">
          <ol className="space-y-3">
            {worksheet.map((it, i) => (
              <li key={i} className="break-inside-avoid rounded-lg border p-3">
                <div className="text-sm font-bold" style={{ color: NAVY }}>
                  {i + 1}. {it.slideTitle}
                </div>
                <ul className="mt-1 space-y-1 text-sm">
                  {it.questions.filter(Boolean).map((q, qi) => (
                    <li key={qi}>
                      • {q}
                      <div className="ps-3 text-[13px]" style={{ color: "#16794A" }}>
                        الإجابة النموذجية: {it.answers?.[qi] || "—"}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 rounded p-2 text-sm" style={{ background: `${GOLD}18` }}>
                  ☐ {it.selfCheck}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="٥. الواجب المنزلي التعويضي">
        <div className="print:hidden">
          <button
            onClick={handleGenerate}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "#5D3FA0" }}
          >
            {busy ? "⏳ جارٍ توليد الواجب من صور الكتاب وأسئلة المراحل..." : "🧠 ولّد واجباً تعويضياً شاملاً"}
          </button>
          <p className="mt-1 text-[11px] text-neutral-500">
            يستند الواجب إلى صفحات الكتاب المستخدمة في العرض وأسئلة مراحل 5E من ورقة العمل وبنك
            الأسئلة.
          </p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>

        {hw ? (
          <div className="mt-3 space-y-3">
            {hw.summary && (
              <p className="rounded-lg border p-3 text-sm" style={{ background: `${GOLD}12` }}>
                {hw.summary}
              </p>
            )}
            {hw.tasks.length > 0 && (
              <ol className="space-y-2">
                {hw.tasks.map((t, i) => (
                  <li key={i} className="break-inside-avoid rounded-lg border p-3">
                    <div className="text-sm font-bold" style={{ color: NAVY }}>
                      {i + 1}. {t.title}{" "}
                      <span className="text-[11px] font-normal text-neutral-500">
                        · {t.phase}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{t.task}</p>
                    {t.hint && (
                      <p className="mt-1 text-[13px]" style={{ color: "#1E7CA8" }}>
                        تلميح: {t.hint}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {hw.selfCheck.length > 0 && (
              <div className="rounded-lg border p-3">
                <div className="mb-1 text-sm font-bold" style={{ color: NAVY }}>
                  تحقق ذاتي
                </div>
                <ul className="space-y-1 text-sm">
                  {hw.selfCheck.map((s, i) => (
                    <li key={i}>☐ {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {hw.studentText && (
              <p className="rounded-lg border p-3 text-sm">
                <span className="font-bold">نص الواجب: </span>
                {hw.studentText}
              </p>
            )}
            {hw.teacherNote && (
              <p className="rounded-lg p-2 text-[13px] text-neutral-700" style={{ background: "#F3F4F6" }}>
                <span className="font-bold">للمعلم: </span>
                {hw.teacherNote}
              </p>
            )}
          </div>
        ) : (
          (plan.homework.studentText || plan.homework.teacherNote) && (
            <p className="mt-3 text-sm">
              {plan.homework.studentText || plan.homework.teacherNote}
            </p>
          )
        )}
      </Section>


      <button
        onClick={() => window.print()}
        className="mt-8 rounded-lg px-4 py-2 text-sm font-bold text-white print:hidden"
        style={{ background: "#1E7CA8" }}
      >
        🖨 طباعة النسخة الشاملة
      </button>
    </main>
  );
}
