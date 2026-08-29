import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AttendanceTracker } from "@/components/AttendanceTracker";
import { getPlan, type PlanRow } from "@/lib/plans-db";
import { useUiLanguage } from "@/lib/ui-language";
import { supabase } from "@/integrations/supabase/client";

/* =========================================================
   TYPES
========================================================= */

type SchoolClass = {
  id: string;
  name_ar: string;
  name_en: string | null;
  grade_number: number;
  section: string | null;
};

/* =========================================================
   ROUTE
========================================================= */

export const Route = createFileRoute("/attendance/$lessonId")({
  ssr: false,
  component: AttendancePage,
});

/* =========================================================
   PAGE
========================================================= */

function AttendancePage() {
  const { lessonId } = Route.useParams();

  const { language } = useUiLanguage();

  const isArabic = language === "ar";

  const [lesson, setLesson] = useState<PlanRow | null>(null);

  const [schoolClass, setSchoolClass] =
    useState<SchoolClass | null>(null);

  const [loading, setLoading] = useState(true);

  /* =======================================================
     LOAD LESSON
  ======================================================= */

  useEffect(() => {
    const loadLesson = async () => {
      try {
        setLoading(true);

        /*
         * 1. تحميل الخطة المحفوظة
         */
        const row = await getPlan(lessonId);

        if (!row) {
          toast.error(
            isArabic
              ? "لم يتم العثور على الخطة"
              : "Lesson plan not found",
          );

          return;
        }

        setLesson(row);

        /*
         * 2. إذا كانت الخطة مرتبطة بفصل
         * نحمل معلومات الفصل.
         */
        if (row.class_id) {
          const { data, error } = await (supabase as any)
            .from("school_classes")
            .select(
              "id, name_ar, name_en, grade_number, section",
            )
            .eq("id", row.class_id)
            .maybeSingle();

          if (error) {
            throw error;
          }

          if (data) {
            setSchoolClass(data as SchoolClass);
          }
        }
      } catch (error) {
        console.error("LOAD ATTENDANCE PAGE ERROR:", error);

        toast.error(
          isArabic
            ? "تعذّر تحميل بيانات الحصة"
            : "Unable to load lesson data",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadLesson();
  }, [lessonId, isArabic]);

  /* =======================================================
     DATE
  ======================================================= */

  const formatLessonDate = (dateValue?: string | null) => {
    if (!dateValue) {
      return "";
    }

    const date = new Date(`${dateValue}T12:00:00`);

    return new Intl.DateTimeFormat(
      isArabic ? "ar-SA" : "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    ).format(date);
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />

          <p className="mt-3 text-sm text-muted-foreground">
            {isArabic
              ? "جارٍ تحميل الحضور..."
              : "Loading attendance..."}
          </p>
        </div>
      </main>
    );
  }

  /* =======================================================
     LESSON NOT FOUND
  ======================================================= */

  if (!lesson) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border bg-background p-8 text-center">
          <h1 className="text-xl font-black">
            {isArabic
              ? "لم يتم العثور على الحصة"
              : "Lesson not found"}
          </h1>

          <Link
            to="/lessons"
            className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground"
          >
            {isArabic ? "العودة إلى دروسي" : "Back to My Lessons"}
          </Link>
        </div>
      </main>
    );
  }

  /* =======================================================
     PAGE UI
  ======================================================= */

  return (
    <main
      className="mx-auto max-w-6xl px-4 py-8"
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* ===================================================
          BACK
      =================================================== */}

      <div className="mb-5">
        <Link
          to="/lessons"
          className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-bold hover:bg-accent"
        >
          <ArrowLeft
            className={`h-4 w-4 ${
              isArabic ? "rotate-180" : ""
            }`}
          />

          {isArabic ? "العودة إلى دروسي" : "Back to My Lessons"}
        </Link>
      </div>

      {/* ===================================================
          HEADER
      =================================================== */}

      <section className="mb-6 rounded-2xl border bg-background p-5">
        <div>
          <p className="text-sm font-bold text-primary">
            {isArabic
              ? "الحضور والمتابعة"
              : "Attendance & Feedback"}
          </p>

          <h1 className="mt-1 text-2xl font-black">
            {lesson.topic ||
              (isArabic ? "بدون عنوان" : "Untitled Lesson")}
          </h1>

          {/* SUBJECT */}

          {lesson.subject && (
            <div className="mt-2 text-sm text-muted-foreground">
              📘 {lesson.subject}
            </div>
          )}

          {/* CLASS */}

          {schoolClass && (
            <div className="mt-1 text-sm text-muted-foreground">
              🏫{" "}
              {isArabic
                ? schoolClass.name_ar
                : schoolClass.name_en || schoolClass.name_ar}
            </div>
          )}

          {/* DATE */}

          {lesson.scheduled_date && (
            <div className="mt-1 text-sm text-muted-foreground">
              📅 {formatLessonDate(lesson.scheduled_date)}
            </div>
          )}
        </div>
      </section>

      {/* ===================================================
          NO CLASS
      =================================================== */}

      {!lesson.class_id ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center">
          <h2 className="font-black text-amber-900">
            {isArabic
              ? "لم يتم تحديد فصل لهذه الحصة"
              : "No class has been assigned to this lesson"}
          </h2>

          <p className="mt-2 text-sm text-amber-800">
            {isArabic
              ? "افتحي الخطة وحددي الصف والفصل أولاً، ثم احفظيها."
              : "Open the lesson, select a class, then save it first."}
          </p>
        </div>
      ) : (
        /* =================================================
           ATTENDANCE TRACKER
        ================================================= */

        <AttendanceTracker
          lessonPlanId={lesson.id}
          classId={lesson.class_id}
        />
      )}
    </main>
  );
}