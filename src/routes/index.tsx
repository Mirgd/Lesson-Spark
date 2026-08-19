import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Play, Sparkles } from "lucide-react";
import { useUiLanguage } from "@/lib/ui-language";

const DESC =
  "مخطط ذكي وفق نموذج 5E لحصة 60 دقيقة مع الواجب — ذكاء اصطناعي يقرأ مقررك ويبني خطة الدرس والعرض التقديمي تلقائياً";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "المدرسة الرمز · التعلم العميق — مخطط الدرس الذكي",
      },
      {
        name: "description",
        content: DESC,
      },
      {
        property: "og:title",
        content: "المدرسة الرمز · التعلم العميق",
      },
      {
        property: "og:description",
        content: DESC,
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:url",
        content: "https://stem-plan-genius.lovable.app/",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: "المدرسة الرمز · التعلم العميق",
      },
      {
        name: "twitter:description",
        content: DESC,
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://stem-plan-genius.lovable.app/",
      },
    ],
  }),

  component: Landing,
});

function Landing() {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl flex-col items-center justify-center px-4 py-16 text-center">
      {/* Top badge */}
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-sm text-gold">
        <Sparkles className="h-4 w-4" />

        <span>
          {isArabic
            ? "المدرسة الرمز · التعلم العميق · نموذج 5E"
            : "Al-Ramz School · Deep Learning · 5E Model"}
        </span>
      </div>

      {/* Main title */}
      <h1 className="text-[32px] font-extrabold leading-[1.2] text-primary md:text-[48px]">
        {isArabic ? (
          <>
            المدرسة الرمز ·{" "}
            <span className="text-gold">التعلم العميق</span>
          </>
        ) : (
          <>
            Al-Ramz School ·{" "}
            <span className="text-gold">Deep Learning</span>
          </>
        )}
      </h1>

      {/* Company */}
      <p className="mt-3 text-sm text-muted-foreground/80">
        {isArabic
          ? "شركة المدارس المتقدمة · Al-Motaqadimah Schools Company"
          : "Al-Motaqadimah Schools Company"}
      </p>

      {/* Description */}
      <p className="mt-6 max-w-[560px] text-[17px] font-normal leading-[1.7] text-muted-foreground md:text-[20px]">
        {isArabic
          ? "مخطط ذكي وفق نموذج 5E لحصة 60 دقيقة مع الواجب — خطط درسك وشغّل شاشة الطالب بنقرة واحدة، وذكاء اصطناعي يقرأ مقررك ويقترح أنشطة عميقة بصياغتين."
          : "An intelligent 5E lesson planner for a 60-minute lesson with homework — plan your lesson, launch the student screen with one click, and let AI read your curriculum and suggest meaningful learning activities."}
      </p>

      {/* Start planning button */}
      <Link
        to="/planning"
        className="mt-10 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-[0_4px_12px_rgba(27,42,74,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#0D1F3C] hover:shadow-[var(--shadow-gold)]"
      >
        {isArabic ? "ابدأ التخطيط الآن" : "Start Planning Now"}
      </Link>

      {/* Feature cards */}
      <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-6 md:grid-cols-3">
        <Step
          icon={<ClipboardList />}
          title={
            isArabic
              ? "تخطيط ذكي وتنفيذ سلس"
              : "Smart Planning, Smooth Delivery"
          }
          desc={
            isArabic
              ? "اكتب نشاط المعلم والطالب في بطاقة واحدة"
              : "Organize teacher and student activities in one clear lesson card."
          }
        />

        <Step
          icon={<Play />}
          title={
            isArabic
              ? "تنفيذ مركّز"
              : "Focused Lesson Delivery"
          }
          desc={
            isArabic
              ? "شاشة المعلم واضحة — شاشة الطالب مستقلة للبروجكتور"
              : "A clear teacher view with a separate student screen for classroom projection."
          }
        />

        <Step
          icon={<Sparkles />}
          title={
            isArabic
              ? "ذكاء يقرأ مقررك"
              : "AI That Reads Your Curriculum"
          }
          desc={
            isArabic
              ? "ارفع PDF/DOCX واحصل على اقتراحات دقيقة"
              : "Upload a PDF or DOCX and receive curriculum-based suggestions."
          }
        />
      </div>

      {/* Standards */}
      <div className="mt-16 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="rounded-full border px-3 py-1">
          Cognia STEM
        </span>

        <span className="rounded-full border px-3 py-1">
          5E Deep Learning
        </span>
      </div>
    </main>
  );
}

function Step({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-[20px] border bg-card p-8 text-start shadow-[0_2px_12px_rgba(27,42,74,0.06)] transition-all duration-250 hover:-translate-y-1 hover:border-gold hover:shadow-[0_12px_32px_rgba(27,42,74,0.12)]">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gold/10 text-gold">
        {icon}
      </div>

      <h3 className="text-[18px] font-bold text-primary">
        {title}
      </h3>

      <p className="mt-2 text-[15px] leading-[1.7] text-muted-foreground">
        {desc}
      </p>
    </div>
  );
}