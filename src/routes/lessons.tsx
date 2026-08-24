import { useUiLanguage } from "@/lib/ui-language";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Copy, Trash2, FolderOpen, Loader2 } from "lucide-react";
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
export const Route = createFileRoute("/lessons")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "دروسي — المدرسة الرمز · التعلم العميق" },
      { name: "description", content: "دروسك المحفوظة في حسابك فقط." },
      { property: "og:title", content: "دروسي — المدرسة الرمز" },
      { property: "og:description", content: "قائمة خطط الدروس الخاصة بحسابك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lessons,
});

function Lessons() {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const { loading, identity } = useSession();
  const navigate = useNavigate();

  const [rows, setRows] = useState<PlanRow[]>([]);
  const [busy, setBusy] = useState(true);

  /*
   * نستخدمها لمعرفة أي درس يتم فتحه الآن
   * حتى نظهر Loading على زر Open نفسه.
   */
  const [openingId, setOpeningId] =
    useState<string | null>(null);

  const userId = identity?.user.id;

  /* =========================================================
     REFRESH
  ========================================================= */

  const refresh = useCallback(async () => {
    if (!userId) return;

    try {
      // دروسي = خطط المستخدم المسجّل فقط
      setRows(await listPlans());
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
  }, [userId, isArabic]);

  useEffect(() => {
    if (loading) return;

    if (!userId) {
      window.location.replace("/auth");
      return;
    }

    void refresh();
  }, [loading, userId, refresh]);

  /* =========================================================
     RESTORE PDF + PAGE IMAGES
  ========================================================= */

  const restoreCurriculumFile = async (
    curriculumFilePath: string,
  ) => {
    /*
     * 1) تنزيل PDF الأصلي من Supabase Storage.
     */
    const file = await downloadLessonPdf(
      curriculumFilePath,
    );

    /*
     * 2) إعادة تسجيله كملف الدرس الحالي.
     *
     * هذا يعيد:
     * - lastPdfFile
     * - اسم الملف
     * - fileId
     */
    setLastPdfFile(file);

    const fileId = getCurrentFileId();

    /*
     * 3) إعادة إنشاء صور صفحات الكتاب.
     *
     * مهم:
     * هذه الدالة لا تستخرج النص ولا تستخدم AI.
     */
    const pages = await extractPdfAsImages(
      file,
      15,
    );

    /*
     * 4) إزالة صور أي درس كان مفتوحاً قبل ذلك.
     */
    await clearPageImages();

    /*
     * 5) إعادة حفظ صور صفحات هذا الدرس.
     */
    for (const page of pages) {
      await putPageImage(
        page.page,
        page.dataUrl,
        fileId,
      );
    }
  };

  /* =========================================================
     OPEN LESSON
  ========================================================= */

  const open = async (row: PlanRow) => {
    setOpeningId(row.id);

    try {
      /*
       * نجلب أحدث نسخة من الخطة.
       */
      const fresh = await getPlan(row.id);

      if (!fresh) {
        toast.error(
          isArabic
            ? "لم يتم العثور على الخطة"
            : "Lesson plan not found",
        );

        return;
      }

      /*
       * نحول صف قاعدة البيانات إلى PlanBundle.
       */
      const bundle = rowToBundle(fresh);

      /*
       * نحفظ:
       * plan
       * worksheet
       * question bank
       * slides
       * curriculumFilePath
       *
       * محلياً أولاً.
       */
      applyBundleLocally(bundle);

      /*
       * إذا كانت الخطة تحتوي PDF محفوظاً،
       * نستعيد الملف وصور صفحات الكتاب.
       */
      if (bundle.curriculumFilePath) {
        try {
          toast.info(
            isArabic
              ? "جارٍ استعادة ملف المقرر وصور الكتاب..."
              : "Restoring curriculum file and book pages...",
          );

          await restoreCurriculumFile(
            bundle.curriculumFilePath,
          );
        } catch (fileError) {
          /*
           * لا نمنع فتح الخطة إذا فشل تحميل PDF.
           * الخطة نفسها ما زالت قابلة للفتح.
           */
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
        /*
         * هذا طبيعي مع الخطط القديمة التي حُفظت
         * قبل إضافة curriculum_file_path.
         */
        console.info(
          `Plan ${row.id} has no stored curriculum PDF.`,
        );
      }

      /*
       * بعد استعادة كل شيء ننتقل للتخطيط.
       */
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

  /* =========================================================
     DUPLICATE
  ========================================================= */

  const duplicate = async (
    row: PlanRow,
  ) => {
    try {
      await duplicatePlan(row.id);

      toast.success(
        isArabic
          ? "تم نسخ الدرس"
          : "Lesson duplicated successfully",
      );

      await refresh();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isArabic
            ? "تعذّر النسخ"
            : "Unable to duplicate the lesson",
      );
    }
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const remove = async (
    row: PlanRow,
  ) => {
    try {
      await deletePlan(row.id);

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

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading || busy) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
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

      {rows.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <p className="text-lg font-medium">
            {isArabic
              ? "لم تُخطط بعد"
              : "No lessons planned yet"}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {isArabic
              ? "درسك القادم على بُعد دقيقتين ✦"
              : "Your next lesson is only a few minutes away ✦"}
          </p>

          <Link
            to="/planning"
            className="mt-5 inline-block rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            {isArabic
              ? "ابدأ التخطيط"
              : "Start Planning"}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            const isOpening =
              openingId === r.id;

            return (
              <div
                key={r.id}
                className="card-elevated flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-primary">
                    {r.topic ||
                      (isArabic
                        ? "بدون موضوع"
                        : "Untitled Lesson")}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {r.subject || "—"} ·{" "}
                    {r.grade || "—"} ·{" "}
                    {new Date(
                      r.updated_at,
                    ).toLocaleDateString(
                      isArabic
                        ? "ar"
                        : "en",
                    )}
                  </div>

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
                  onClick={() =>
                    void open(r)
                  }
                  disabled={
                    openingId !== null
                  }
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

                {/* DUPLICATE */}
                <button
                  type="button"
                  onClick={() =>
                    void duplicate(r)
                  }
                  disabled={
                    openingId !== null
                  }
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
                  onClick={() =>
                    void remove(r)
                  }
                  disabled={
                    openingId !== null
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />

                  {isArabic
                    ? "حذف"
                    : "Delete"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

const btnGhost =
  "inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-accent";
