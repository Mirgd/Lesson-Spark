import { createFileRoute } from "@tanstack/react-router";
import { PHASES, useCurrentPlan } from "@/lib/lesson-types";
import { PhaseImages } from "@/components/PhaseImages";
import { StudentOutcomes } from "@/components/StudentOutcomes";
import { RichText } from "@/components/RichText";


export const Route = createFileRoute("/student-view")({
  head: () => ({
    meta: [{ title: "شاشة الطالب — المدرسة الرمز" }],
  }),
  component: StudentViewPage,
});

function StudentViewPage() {
  const [plan] = useCurrentPlan();

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <div className="text-sm text-muted-foreground">
            {plan.subject || "—"} · {plan.grade || "—"}
          </div>
          <h1 className="mt-1 text-4xl font-black text-primary">
            {plan.topic || "موضوع اليوم"}
          </h1>
        </div>

        <StudentOutcomes plan={plan} />


        <div className="space-y-4">
          {PHASES.map((meta) => {
            const data = plan.phases.find((p) => p.id === meta.id)!;
            return (
              <div
                key={meta.id}
                className="rounded-xl border-2 bg-card p-5"
                style={{ borderInlineStartWidth: 6, borderInlineStartColor: meta.color }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-lg font-bold" style={{ color: meta.color }}>
                    ● {meta.nameAr}
                  </span>
                  <span className="text-sm text-muted-foreground">{data.duration} دقيقة</span>
                </div>
                {data.studentActivity.trim() ? (
                  <RichText
                    text={data.studentActivity}
                    className="whitespace-pre-wrap text-lg leading-loose"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-lg leading-loose">
                    <span className="text-muted-foreground/60 italic">
                      {meta.studentPlaceholder}
                    </span>
                  </p>
                )}

                <PhaseImages images={data.images} className="mt-3" />

              </div>
            );
          })}
        </div>

        <div
          className="mt-6 rounded-xl border-2 bg-card p-5"
          style={{ borderInlineStartWidth: 6, borderInlineStartColor: "#888" }}
        >
          <div className="mb-2 text-lg font-bold">📋 تحدّيك المنزلي</div>
          {plan.homework.studentText.trim() ? (
            <RichText
              text={plan.homework.studentText}
              className="whitespace-pre-wrap text-lg leading-loose"
            />
          ) : (
            <p className="whitespace-pre-wrap text-lg leading-loose">
              <span className="text-muted-foreground/60 italic">تحدّيك خارج الفصل: ...</span>
            </p>
          )}

        </div>
      </div>
    </main>
  );
}
