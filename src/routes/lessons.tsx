import { useUiLanguage } from "@/lib/ui-language";

import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Copy,
  Trash2,
  FolderOpen,
  Loader2,
  Users,
} from "lucide-react";

import { toast } from "sonner";

import { useSession } from "@/lib/session";

import {
  applyBundleLocally,
  deletePlan,
  duplicatePlan,
  getPlan,
  listPlans,
  rowToBundle,
  type PlanRow,
} from "@/lib/plans-db";

import { NewLessonButton } from "@/components/NewLessonButton";

import { downloadLessonPdf } from "@/lib/lesson-files";

import {
  extractPdfAsImages,
  setLastPdfFile,
  getCurrentFileId,
} from "@/lib/pdf-images";

import {
  clearPageImages,
  putPageImage,
} from "@/lib/presentation";

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

type GradeTab = {
  value: string;
  ar: string;
  en: string;
};

/* =========================================================
   GRADES
========================================================= */

const GRADE_TABS: GradeTab[] = [
  {
    value: "all",
    ar: "الكل",
    en: "All",
  },

  {
    value: "1",
    ar: "الأول ابتدائي",
    en: "Grade 1",
  },

  {
    value: "2",
    ar: "الثاني ابتدائي",
    en: "Grade 2",
  },

  {
    value: "3",
    ar: "الثالث ابتدائي",
    en: "Grade 3",
  },

  {
    value: "4",
    ar: "الرابع ابتدائي",
    en: "Grade 4",
  },

  {
    value: "5",
    ar: "الخامس ابتدائي",
    en: "Grade 5",
  },

  {
    value: "6",
    ar: "السادس ابتدائي",
    en: "Grade 6",
  },

  {
    value: "7",
    ar: "الأول متوسط",
    en: "Grade 7",
  },

  {
    value: "8",
    ar: "الثاني متوسط",
    en: "Grade 8",
  },

  {
    value: "9",
    ar: "الثالث متوسط",
    en: "Grade 9",
  },

  {
    value: "10",
    ar: "الأول ثانوي",
    en: "Grade 10",
  },

  {
    value: "11",
    ar: "الثاني ثانوي",
    en: "Grade 11",
  },

  {
    value: "12",
    ar: "الثالث ثانوي",
    en: "Grade 12",
  },
];

/* =========================================================
   ROUTE
========================================================= */

export const Route = createFileRoute("/lessons")({
  ssr: false,

  head: () => ({
    meta: [
      {
        title:
          "دروسي — المدرسة الرمز · التعلم العميق",
      },

      {
        name: "description",
        content:
          "دروسك المحفوظة في حسابك فقط.",
      },

      {
        property: "og:title",
        content:
          "دروسي — المدرسة الرمز",
      },

      {
        property: "og:description",
        content:
          "قائمة خطط الدروس الخاصة بحسابك.",
      },

      {
        property: "og:type",
        content: "website",
      },

      {
        name: "twitter:card",
        content: "summary",
      },
    ],
  }),

  component: Lessons,
});

/* =========================================================
   LESSONS
========================================================= */

function Lessons() {
  const { language } =
    useUiLanguage();

  const isArabic =
    language === "ar";

  const {
    loading,
    identity,
  } = useSession();

  const navigate =
    useNavigate();

  /* =======================================================
     STATE
  ======================================================= */

  const [rows, setRows] =
    useState<PlanRow[]>([]);

  const [busy, setBusy] =
    useState(true);

  /*
   * الصف المحدد.
   *
   * all = كل الصفوف.
   */
  const [
    selectedGrade,
    setSelectedGrade,
  ] = useState<string>("all");

  /*
   * الفصل / الشعبة المحددة.
   *
   * all = كل فصول الصف.
   */
  const [
    selectedClassId,
    setSelectedClassId,
  ] = useState<string>("all");

  /*
   * قائمة الفصول من Supabase.
   */
  const [
    schoolClasses,
    setSchoolClasses,
  ] = useState<SchoolClass[]>([]);

  /*
   * الدرس الذي يتم فتحه.
   */
  const [
    openingId,
    setOpeningId,
  ] = useState<string | null>(null);

  /*
   * نافذة نسخ الخطة.
   */
  const [
    copyingPlan,
    setCopyingPlan,
  ] = useState<PlanRow | null>(null);

  const [
    copyClassId,
    setCopyClassId,
  ] = useState("");

  const [
    copyDate,
    setCopyDate,
  ] = useState("");

  const [
    copying,
    setCopying,
  ] = useState(false);

  const userId =
    identity?.user.id;

  /* =======================================================
     GET GRADE NUMBER FROM OLD TEXT
  ======================================================= */

  const getGradeNumber = (
    grade?: string | null,
  ): number | null => {
    if (!grade) {
      return null;
    }

    const value =
      grade.toLowerCase();

    /*
     * English first because:
     *
     * "grade 10" contains "grade 1"
     * ولذلك نتحقق من 10 و11 و12 أولاً.
     */

    if (
      value.includes("grade 12")
    ) {
      return 12;
    }

    if (
      value.includes("grade 11")
    ) {
      return 11;
    }

    if (
      value.includes("grade 10")
    ) {
      return 10;
    }

    if (
      value.includes("grade 9")
    ) {
      return 9;
    }

    if (
      value.includes("grade 8")
    ) {
      return 8;
    }

    if (
      value.includes("grade 7")
    ) {
      return 7;
    }

    if (
      value.includes("grade 6")
    ) {
      return 6;
    }

    if (
      value.includes("grade 5")
    ) {
      return 5;
    }

    if (
      value.includes("grade 4")
    ) {
      return 4;
    }

    if (
      value.includes("grade 3")
    ) {
      return 3;
    }

    if (
      value.includes("grade 2")
    ) {
      return 2;
    }

    if (
      value.includes("grade 1")
    ) {
      return 1;
    }

    /*
     * Arabic.
     */

    if (
      value.includes("الثالث ثانوي") ||
      value.includes("الثالث الثانوي")
    ) {
      return 12;
    }

    if (
      value.includes("الثاني ثانوي") ||
      value.includes("الثاني الثانوي")
    ) {
      return 11;
    }

    if (
      value.includes("الأول ثانوي") ||
      value.includes("الأول الثانوي")
    ) {
      return 10;
    }

    if (
      value.includes("الثالث متوسط") ||
      value.includes("الثالث المتوسط")
    ) {
      return 9;
    }

    if (
      value.includes("الثاني متوسط") ||
      value.includes("الثاني المتوسط")
    ) {
      return 8;
    }

    if (
      value.includes("الأول متوسط") ||
      value.includes("الأول المتوسط")
    ) {
      return 7;
    }

    if (
      value.includes("السادس")
    ) {
      return 6;
    }

    if (
      value.includes("الخامس")
    ) {
      return 5;
    }

    if (
      value.includes("الرابع")
    ) {
      return 4;
    }

    if (
      value.includes("الثالث")
    ) {
      return 3;
    }

    if (
      value.includes("الثاني")
    ) {
      return 2;
    }

    if (
      value.includes("الأول")
    ) {
      return 1;
    }

    return null;
  };

  /* =======================================================
     GET REAL GRADE FROM CLASS
  ======================================================= */

  /*
   * هذه هي الدالة المهمة التي تصلح المشكلة
   * التي حدثت في النسخة.
   *
   * إذا كانت الخطة مرتبطة بفصل:
   * نستخدم grade_number الخاص بالفصل.
   *
   * ولا نعتمد على grade القديم داخل الخطة.
   */
  const getRowGradeNumber = (
    row: PlanRow,
  ): number | null => {
    if (row.class_id) {
      const schoolClass =
        schoolClasses.find(
          (item) =>
            item.id ===
            row.class_id,
        );

      if (
        schoolClass?.grade_number
      ) {
        return schoolClass.grade_number;
      }
    }

    /*
     * fallback للخطط القديمة
     * التي لم يكن لها class_id.
     */
    return getGradeNumber(
      row.grade,
    );
  };

  /* =======================================================
     GRADE LABEL
  ======================================================= */

  const getGradeLabel = (
    gradeNumber: number | null,
  ) => {
    if (!gradeNumber) {
      return "—";
    }

    const labels: Record<
      number,
      {
        ar: string;
        en: string;
      }
    > = {
      1: {
        ar: "الأول الابتدائي",
        en: "Grade 1",
      },

      2: {
        ar: "الثاني الابتدائي",
        en: "Grade 2",
      },

      3: {
        ar: "الثالث الابتدائي",
        en: "Grade 3",
      },

      4: {
        ar: "الرابع الابتدائي",
        en: "Grade 4",
      },

      5: {
        ar: "الخامس الابتدائي",
        en: "Grade 5",
      },

      6: {
        ar: "السادس الابتدائي",
        en: "Grade 6",
      },

      7: {
        ar: "الأول المتوسط",
        en: "Grade 7",
      },

      8: {
        ar: "الثاني المتوسط",
        en: "Grade 8",
      },

      9: {
        ar: "الثالث المتوسط",
        en: "Grade 9",
      },

      10: {
        ar: "الأول الثانوي",
        en: "Grade 10",
      },

      11: {
        ar: "الثاني الثانوي",
        en: "Grade 11",
      },

      12: {
        ar: "الثالث الثانوي",
        en: "Grade 12",
      },
    };

    return isArabic
      ? labels[gradeNumber]?.ar ??
          "—"
      : labels[gradeNumber]?.en ??
          "—";
  };

  /* =======================================================
     FILTER BY GRADE
  ======================================================= */

  const gradeFilteredRows:
    PlanRow[] =
    selectedGrade === "all"
      ? rows
      : rows.filter(
          (row) =>
            getRowGradeNumber(
              row,
            ) ===
            Number(
              selectedGrade,
            ),
        );

  /* =======================================================
     FILTER BY CLASS
  ======================================================= */

  const filteredRows:
    PlanRow[] =
    selectedClassId === "all"
      ? gradeFilteredRows
      : gradeFilteredRows.filter(
          (row) =>
            row.class_id ===
            selectedClassId,
        );

  /* =======================================================
     CLASSES FOR SELECTED GRADE
  ======================================================= */

  const classesForSelectedGrade =
    selectedGrade === "all"
      ? []
      : schoolClasses.filter(
          (schoolClass) =>
            schoolClass.grade_number ===
            Number(
              selectedGrade,
            ),
        );

  /* =======================================================
     COUNTS
  ======================================================= */

  const getGradeLessonCount = (
    gradeNumber: number,
  ) => {
    return rows.filter(
      (row) =>
        getRowGradeNumber(
          row,
        ) === gradeNumber,
    ).length;
  };

  const getClassLessonCount = (
    classId: string,
  ) => {
    return gradeFilteredRows.filter(
      (row) =>
        row.class_id ===
        classId,
    ).length;
  };

  /* =======================================================
     REFRESH
  ======================================================= */

  const refresh =
    useCallback(async () => {
      if (!userId) {
        return;
      }

      try {
        /*
         * نجلب الخطط والفصول معاً.
         */
        const [
          plans,
          classesResult,
        ] = await Promise.all([
          listPlans(),

          (supabase as any)
            .from(
              "school_classes",
            )
            .select(
              "id, name_ar, name_en, grade_number, section",
            )
            .order(
              "grade_number",
              {
                ascending: true,
              },
            )
            .order(
              "section",
              {
                ascending: true,
              },
            ),
        ]);

        setRows(plans);

        if (
          classesResult.error
        ) {
          console.error(
            "Unable to load school classes:",
            classesResult.error,
          );
        } else {
          setSchoolClasses(
            (
              classesResult.data ??
              []
            ) as SchoolClass[],
          );
        }
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : isArabic
              ? "تعذّر تحميل الدروس"
              : "Unable to load lessons",
        );
      } finally {
        setBusy(false);
      }
    }, [
      userId,
      isArabic,
    ]);

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!userId) {
      window.location.replace(
        "/auth",
      );

      return;
    }

    void refresh();
  }, [
    loading,
    userId,
    refresh,
  ]);

  /* =======================================================
     CLASS NAME
  ======================================================= */

  const getClassName = (
    classId?: string | null,
  ) => {
    if (!classId) {
      return "";
    }

    const schoolClass =
      schoolClasses.find(
        (item) =>
          item.id === classId,
      );

    if (!schoolClass) {
      return "";
    }

    return isArabic
      ? schoolClass.name_ar
      : schoolClass.name_en ||
          schoolClass.name_ar;
  };

  /* =======================================================
     FORMAT LESSON DATE
  ======================================================= */

  const formatLessonDate = (
    dateValue?: string | null,
  ) => {
    if (!dateValue) {
      return "";
    }

    const date =
      new Date(
        `${dateValue}T12:00:00`,
      );

    return new Intl.DateTimeFormat(
      isArabic
        ? "ar-SA"
        : "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    ).format(date);
  };

  /* =======================================================
     RESTORE CURRICULUM
  ======================================================= */

  const restoreCurriculumFile =
    async (
      curriculumFilePath: string,
    ) => {
      const file =
        await downloadLessonPdf(
          curriculumFilePath,
        );

      setLastPdfFile(file);

      const fileId =
        getCurrentFileId();

      /*
       * حالياً 15 صفحة كما كان
       * في الملف الأصلي.
       */
      const pages =
        await extractPdfAsImages(
          file,
          15,
        );

      await clearPageImages();

      for (
        const page of pages
      ) {
        await putPageImage(
          page.page,
          page.dataUrl,
          fileId,
        );
      }
    };

  /* =======================================================
     OPEN LESSON
  ======================================================= */

  const open = async (
    row: PlanRow,
  ) => {
    setOpeningId(row.id);

    try {
      const fresh =
        await getPlan(
          row.id,
        );

      if (!fresh) {
        toast.error(
          isArabic
            ? "لم يتم العثور على الخطة"
            : "Lesson plan not found",
        );

        return;
      }

      const bundle =
        rowToBundle(
          fresh,
        );

      applyBundleLocally(
        bundle,
      );

      if (
        bundle.curriculumFilePath
      ) {
        try {
          toast.info(
            isArabic
              ? "جارٍ استعادة ملف المقرر وصور الكتاب..."
              : "Restoring curriculum file and book pages...",
          );

          await restoreCurriculumFile(
            bundle.curriculumFilePath,
          );
        } catch (
          fileError
        ) {
          console.error(
            "Unable to restore curriculum PDF:",
            fileError,
          );

          toast.warning(
            isArabic
              ? "تم فتح الخطة، لكن تعذّرت استعادة صور الكتاب."
              : "The lesson was opened, but the book images could not be restored.",
          );
        }
      } else {
        console.info(
          `Plan ${row.id} has no stored curriculum PDF.`,
        );
      }

      navigate({
        to: "/planning",
      });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isArabic
            ? "تعذّر فتح الدرس"
            : "Unable to open the lesson",
      );
    } finally {
      setOpeningId(null);
    }
  };

  /* =======================================================
     DUPLICATE
  ======================================================= */

  const duplicate =
    async () => {
      if (!copyingPlan) {
        return;
      }

      if (!copyClassId) {
        toast.error(
          isArabic
            ? "اختاري الفصل أو الشعبة الجديدة"
            : "Please select the new class",
        );

        return;
      }

      if (!copyDate) {
        toast.error(
          isArabic
            ? "اختاري تاريخ الحصة الجديدة"
            : "Please select the new lesson date",
        );

        return;
      }

      try {
        setCopying(true);

        await duplicatePlan(
          copyingPlan.id,
          copyClassId,
          copyDate,
        );

        toast.success(
          isArabic
            ? "تم إنشاء نسخة جديدة من الخطة"
            : "A new copy of the lesson was created",
        );

        setCopyingPlan(
          null,
        );

        setCopyClassId(
          "",
        );

        setCopyDate(
          "",
        );

        await refresh();
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : isArabic
              ? "تعذّر نسخ الخطة"
              : "Unable to duplicate the lesson",
        );
      } finally {
        setCopying(
          false,
        );
      }
    };

  /* =======================================================
     DELETE
  ======================================================= */

  const remove = async (
    row: PlanRow,
  ) => {
    try {
      await deletePlan(
        row.id,
      );

      toast.success(
        isArabic
          ? "تم الحذف"
          : "Lesson deleted successfully",
      );

      await refresh();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isArabic
            ? "تعذّر الحذف"
            : "Unable to delete the lesson",
      );
    }
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    loading ||
    busy
  ) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">

        <div>

          <h1 className="text-3xl font-black text-primary">
            {isArabic
              ? "دروسي"
              : "My Lessons"}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {isArabic
              ? "دروسك المحفوظة في حسابك."
              : "Your saved lessons in your account."}
          </p>

        </div>

        <NewLessonButton
          variant="primary"
          label={
            isArabic
              ? "ابدأ درساً جديداً"
              : "Start a New Lesson"
          }
        />

      </header>

      {/* ===================================================
          GRADE TABS
      =================================================== */}

      <div className="mb-4 rounded-2xl border bg-background p-3">

        <div className="mb-2 text-xs font-bold text-muted-foreground">
          {isArabic
            ? "تصفية الدروس حسب الصف"
            : "Filter lessons by grade"}
        </div>

        <div className="flex flex-wrap gap-2">

          {GRADE_TABS.map(
            (grade) => {
              const count =
                grade.value ===
                "all"
                  ? rows.length
                  : getGradeLessonCount(
                      Number(
                        grade.value,
                      ),
                    );

              return (
                <button
                  key={
                    grade.value
                  }
                  type="button"
                  onClick={() => {
                    setSelectedGrade(
                      grade.value,
                    );

                    /*
                     * عند تغيير الصف:
                     * نلغي فلتر الفصل السابق.
                     */
                    setSelectedClassId(
                      "all",
                    );
                  }}
                  className={
                    selectedGrade ===
                    grade.value
                      ? "rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                      : "rounded-full border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                  }
                >
                  {isArabic
                    ? grade.ar
                    : grade.en}{" "}
                  ({count})
                </button>
              );
            },
          )}

        </div>

      </div>

      {/* ===================================================
          CLASS / SECTION FILTER
      =================================================== */}

      {selectedGrade !==
        "all" &&
        classesForSelectedGrade.length >
          0 && (
          <div className="mb-6 rounded-2xl border bg-muted/30 p-3">

            <div className="mb-2 text-xs font-bold text-muted-foreground">
              {isArabic
                ? "تصفية حسب الفصل / الشعبة"
                : "Filter by Class / Section"}
            </div>

            <div className="flex flex-wrap gap-2">

              {/* ALL CLASSES */}

              <button
                type="button"
                onClick={() =>
                  setSelectedClassId(
                    "all",
                  )
                }
                className={
                  selectedClassId ===
                  "all"
                    ? "rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                    : "rounded-lg border bg-background px-3 py-2 text-sm hover:bg-accent"
                }
              >
                {isArabic
                  ? "كل الفصول"
                  : "All Classes"}{" "}
                (
                {
                  gradeFilteredRows.length
                }
                )
              </button>

              {/* EACH CLASS */}

              {classesForSelectedGrade.map(
                (
                  schoolClass,
                ) => {
                  const count =
                    getClassLessonCount(
                      schoolClass.id,
                    );

                  return (
                    <button
                      key={
                        schoolClass.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedClassId(
                          schoolClass.id,
                        )
                      }
                      className={
                        selectedClassId ===
                        schoolClass.id
                          ? "rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                          : "rounded-lg border bg-background px-3 py-2 text-sm hover:bg-accent"
                      }
                    >
                      {isArabic
                        ? schoolClass.name_ar
                        : schoolClass.name_en ||
                          schoolClass.name_ar}{" "}
                      ({count})
                    </button>
                  );
                },
              )}

            </div>

          </div>
        )}

      {/* ===================================================
          EMPTY
      =================================================== */}

      {filteredRows.length ===
      0 ? (

        <div className="card-elevated p-10 text-center">

          <p className="text-lg font-medium">
            {rows.length === 0
              ? isArabic
                ? "لم تُخطط بعد"
                : "No lessons planned yet"
              : isArabic
                ? "لا توجد دروس محفوظة ضمن هذا التصنيف"
                : "No saved lessons in this category"}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length === 0
              ? isArabic
                ? "درسك القادم على بُعد دقيقتين ✦"
                : "Your next lesson is only a few minutes away ✦"
              : isArabic
                ? "اختاري صفاً أو فصلاً آخر."
                : "Choose another grade or class."}
          </p>

          {rows.length ===
            0 && (
            <Link
              to="/planning"
              className="mt-5 inline-block rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              {isArabic
                ? "ابدأ التخطيط"
                : "Start Planning"}
            </Link>
          )}

        </div>

      ) : (

        /* =================================================
           CARDS
        ================================================= */

        <div className="grid gap-3">

          {filteredRows.map(
            (
              r: PlanRow,
            ) => {
              const isOpening =
                openingId ===
                r.id;

              const actualGradeNumber =
                getRowGradeNumber(
                  r,
                );

              return (
                <div
                  key={r.id}
                  className="card-elevated flex flex-wrap items-center gap-3 p-4"
                >

                  {/* =============================
                      INFO
                  ============================= */}

                  <div className="min-w-0 flex-1">

                    <div className="truncate font-bold text-primary">
                      {r.topic ||
                        (isArabic
                          ? "بدون موضوع"
                          : "Untitled Lesson")}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {r.subject ||
                        "—"}{" "}
                      ·{" "}
                      {getGradeLabel(
                        actualGradeNumber,
                      )}
                    </div>

                    {/* CLASS */}

                    {r.class_id && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        🏫{" "}
                        {getClassName(
                          r.class_id,
                        )}
                      </div>
                    )}

                    {/* DATE */}

                    {r.scheduled_date && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        📅{" "}
                        {formatLessonDate(
                          r.scheduled_date,
                        )}
                      </div>
                    )}

                    {/* CURRICULUM */}

                    {r.curriculum_file_path && (
                      <div className="mt-1 text-[11px] text-green-700">
                        {isArabic
                          ? "📎 ملف المقرر محفوظ"
                          : "📎 Curriculum file saved"}
                      </div>
                    )}

                  </div>

                  {/* OPEN */}

<button
  type="button"
  onClick={() => void open(r)}
  disabled={openingId !== null}
  className={btnGhost}
>
  {isOpening ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <FolderOpen className="h-4 w-4" />
  )}

  {isOpening
    ? isArabic
      ? "جارٍ الفتح..."
      : "Opening..."
    : isArabic
      ? "فتح"
      : "Open"}
</button>

{/* ATTENDANCE */}

<Link
  to="/attendance/$lessonId"
  params={{
    lessonId: r.id,
  }}
  className={btnGhost}
>
  <Users className="h-4 w-4" />

  {isArabic
    ? "الحضور والمتابعة"
    : "Attendance"}
</Link>

{/* COPY */}

<button
  type="button"
  onClick={() => {
    setCopyingPlan(r);
    setCopyClassId(r.class_id ?? "");
    setCopyDate(r.scheduled_date ?? "");
  }}
  disabled={openingId !== null}
  className={btnGhost}
>
  <Copy className="h-4 w-4" />

  {isArabic
    ? "نسخ"
    : "Duplicate"}
</button>

{/* DELETE */}

<button
  type="button"
  onClick={() => void remove(r)}
  disabled={openingId !== null}
  className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
>
  <Trash2 className="h-4 w-4" />

  {isArabic
    ? "حذف"
    : "Delete"}
</button>

                </div>
              );
            },
          )}

        </div>
      )}

      {/* ===================================================
          DUPLICATE MODAL
      =================================================== */}

      {copyingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">

          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">

            <h2 className="text-xl font-black text-primary">
              {isArabic
                ? "نسخ الخطة إلى حصة جديدة"
                : "Duplicate Lesson"}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {copyingPlan.topic ||
                (isArabic
                  ? "خطة بدون عنوان"
                  : "Untitled lesson")}
            </p>

            <div className="mt-5 space-y-4">

              {/* =============================
                  CLASS
              ============================= */}

              <div>

                <label className="mb-1 block text-sm font-bold">
                  {isArabic
                    ? "الفصل / الشعبة الجديدة"
                    : "New Class / Section"}
                </label>

                <select
                  value={
                    copyClassId
                  }
                  onChange={(
                    e,
                  ) =>
                    setCopyClassId(
                      e.target.value,
                    )
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2"
                >

                  <option value="">
                    {isArabic
                      ? "اختاري الفصل"
                      : "Select Class"}
                  </option>

                  {schoolClasses.map(
                    (
                      schoolClass,
                    ) => (
                      <option
                        key={
                          schoolClass.id
                        }
                        value={
                          schoolClass.id
                        }
                      >
                        {isArabic
                          ? schoolClass.name_ar
                          : schoolClass.name_en ||
                            schoolClass.name_ar}
                      </option>
                    ),
                  )}

                </select>

              </div>

              {/* =============================
                  DATE
              ============================= */}

              <div>

                <label className="mb-1 block text-sm font-bold">
                  {isArabic
                    ? "تاريخ الحصة الجديدة"
                    : "New Lesson Date"}
                </label>

                <input
                  type="date"
                  value={copyDate}
                  onChange={(
                    e,
                  ) =>
                    setCopyDate(
                      e.target.value,
                    )
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />

              </div>

              {/* =============================
                  DAY
              ============================= */}

              {copyDate && (
                <div className="rounded-lg bg-muted px-3 py-2 text-sm">

                  <span className="font-bold">
                    {isArabic
                      ? "اليوم: "
                      : "Day: "}
                  </span>

                  {new Intl.DateTimeFormat(
                    isArabic
                      ? "ar-SA"
                      : "en-US",
                    {
                      weekday:
                        "long",
                    },
                  ).format(
                    new Date(
                      `${copyDate}T12:00:00`,
                    ),
                  )}

                </div>
              )}

            </div>

            {/* =============================
                MODAL BUTTONS
            ============================= */}

            <div className="mt-6 flex justify-end gap-2">

              <button
                type="button"
                disabled={
                  copying
                }
                onClick={() => {
                  setCopyingPlan(
                    null,
                  );

                  setCopyClassId(
                    "",
                  );

                  setCopyDate(
                    "",
                  );
                }}
                className={
                  btnGhost
                }
              >
                {isArabic
                  ? "إلغاء"
                  : "Cancel"}
              </button>

              <button
                type="button"
                disabled={
                  copying
                }
                onClick={() =>
                  void duplicate()
                }
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >

                {copying
                  ? isArabic
                    ? "جارٍ إنشاء النسخة..."
                    : "Creating..."
                  : isArabic
                    ? "إنشاء النسخة"
                    : "Create Copy"}

              </button>

            </div>

          </div>

        </div>
      )}

    </main>
  );
}

/* =========================================================
   BUTTON
========================================================= */

const btnGhost =
  "inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-accent";