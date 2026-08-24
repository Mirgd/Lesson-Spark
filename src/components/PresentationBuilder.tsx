import { useUiLanguage } from "@/lib/ui-language";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Play,
  Trash2,
  Plus,
  ChevronRight,
  ChevronLeft,
  Pencil,
} from "lucide-react";

import {
  buildPresentation,
  clearPageImages,
  putPageImage,
  reindex,
  usePresentation,
  downloadPresentationPptx,
  PHASE_LABELS,
  type AnalyzedPage,
  type Slide,
} from "@/lib/presentation";

import {
  extractPdfAsImages,
  useSharedFile,
  setLastPdfFile,
  getCurrentFileId,
} from "@/lib/pdf-images";

import {
  planLang,
  type LessonPlan,
  useCurriculum,
} from "@/lib/lesson-types";

import { analyzePresentationFromText } from "@/lib/vision.functions";
import { clearFileArtifacts } from "@/lib/lesson-reset";
import { SlideView } from "@/components/SlideView";
import { reportAiError } from "@/lib/ai-error";
import { SharedFileBadge } from "@/components/SharedFileBadge";

const PURPLE = "#5D3FA0";

export function PresentationBuilder({
  plan,
}: {
  plan: LessonPlan;
}) {
  const { text: curriculumText } = useCurriculum();

  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const [slides, setSlides] = usePresentation();

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");

  const { file: sharedFile, name: sharedName } =
    useSharedFile();

  const hasPdf = Boolean(sharedFile);

  /*
   * الشريحة المفتوحة في المعاينة.
   */
  const [preview, setPreview] =
    useState<number | null>(null);

  /*
   * الشريحة المفتوحة في وضع التعديل.
   */
  const [editing, setEditing] =
    useState<number | null>(null);

  const dragIdx =
    useRef<number | null>(null);

  const inputRef =
    useRef<HTMLInputElement | null>(null);

  /*
   * اسم مرحلة 5E حسب لغة الواجهة.
   */
  const phaseName = (
    phase: Slide["phase"],
  ) => {
    if (isArabic) {
      return (
        PHASE_LABELS[phase]?.ar ??
        phase
      );
    }

    const names: Record<
      string,
      string
    > = {
      engage: "Engage",
      explore: "Explore",
      explain: "Explain",
      elaborate: "Elaborate",
      evaluate: "Evaluate",
      extend: "Homework",
      homework: "Homework",
      cover: "Cover",
    };

    return names[phase] ?? phase;
  };

  /*
   * تحميل العرض بصيغة PowerPoint.
   */
  const downloadPptx = async () => {
    if (!slides.length) {
      toast.error(
        isArabic
          ? "أنشئ العرض أولاً"
          : "Generate the presentation first",
      );

      return;
    }

    try {
      await downloadPresentationPptx(
        slides,
        plan.topic ||
          "lesson-presentation",
      );

      toast.success(
        isArabic
          ? "تم تحميل العرض التقديمي"
          : "Presentation downloaded successfully",
      );
    } catch (error) {
      console.error(
        "PowerPoint download failed:",
        error,
      );

      toast.error(
        isArabic
          ? "تعذّر تحميل العرض التقديمي"
          : "Unable to download presentation",
      );
    }
  };

  /*
   * بناء العرض من ملف PDF.
   */
  const run = async (
    file: File,
  ) => {
    setBusy(true);

    setDone(0);
    setTotal(0);

    setStatus(
      isArabic
        ? "جارٍ تحويل صفحات الكتاب إلى صور..."
        : "Converting book pages to images...",
    );

    try {
      const fileId =
        getCurrentFileId();

      const pages =
        await extractPdfAsImages(
          file,
          15,
          (d, t) => {
            setDone(d);
            setTotal(t);
          },
        );

      /*
       * حفظ صور صفحات الكتاب محلياً.
       */
      await clearPageImages();

      for (const page of pages) {
        await putPageImage(
          page.page,
          page.dataUrl,
          fileId,
        );
      }

      /*
       * إذا تغيّر الملف أثناء المعالجة
       * نتوقف حتى لا تختلط ملفات الدروس.
       */
      if (
        getCurrentFileId() !==
        fileId
      ) {
        return;
      }

      if (!pages.length) {
        throw new Error(
          isArabic
            ? "لم يتم العثور على صفحات في ملف PDF."
            : "No pages were found in the PDF file.",
        );
      }

      if (!curriculumText.trim()) {
        throw new Error(
          isArabic
            ? "لم يتم العثور على نص المقرر. ارفع ملف الدرس من قسم تحميل المقرر أولاً."
            : "No curriculum text was found. Upload the lesson file from the curriculum upload section first.",
        );
      }

      setDone(0);
      setTotal(1);

      setStatus(
        isArabic
          ? "جارٍ بناء محتوى العرض..."
          : "Building presentation content...",
      );

      /*
       * طلب AI واحد لإنشاء محتوى العرض.
       */
      const analyzed =
        (await analyzePresentationFromText({
          data: {
            text: curriculumText,
            pageCount:
              pages.length,
            topic:
              plan.topic,
            subject:
              plan.subject,
            lang:
              planLang(plan),
          },
        })) as AnalyzedPage[];

      if (!analyzed.length) {
        throw new Error(
          isArabic
            ? "لم يتمكن الذكاء الاصطناعي من إنشاء محتوى العرض."
            : "AI was unable to generate the presentation content.",
        );
      }

      setDone(1);

      if (
        getCurrentFileId() !==
        fileId
      ) {
        return;
      }

      const built =
        buildPresentation(
          analyzed,
          plan,
        );

      setSlides(built);

      /*
       * إغلاق أي معاينة أو تعديل قديم.
       */
      setPreview(null);
      setEditing(null);

      toast.success(
        isArabic
          ? `تم بناء العرض — ${built.length} شرائح`
          : `Presentation created — ${built.length} slides`,
      );
    } catch (error) {
      toast.error(
        reportAiError(
          error,
          isArabic
            ? "بناء العرض التقديمي"
            : "Presentation Builder",
          isArabic
            ? "فشل بناء العرض"
            : "Failed to build the presentation",
        ),
      );
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  /*
   * بدء بناء العرض.
   */
  const start = () => {
    if (sharedFile) {
      void run(sharedFile);
    } else {
      inputRef.current?.click();
    }
  };

  /*
   * حذف شريحة.
   */
  const removeSlide = (
    index: number,
  ) => {
    setSlides(
      reindex(
        slides.filter(
          (_, idx) =>
            idx !== index,
        ),
      ),
    );

    if (
      preview === index
    ) {
      setPreview(null);
    }

    if (
      editing === index
    ) {
      setEditing(null);
    }
  };

  /*
   * إضافة شريحة فارغة.
   */
  const addBlank = () => {
    setSlides(
      reindex([
        ...slides,
        {
          id: slides.length,
          type: "blank",
          phase: "explain",
          title: isArabic
            ? "شريحة جديدة"
            : "New Slide",
          points: [""],
          question: "",
        } as Slide,
      ]),
    );
  };

  /*
   * تحريك شريحة.
   */
  const move = (
    from: number,
    to: number,
  ) => {
    if (
      to < 0 ||
      to >= slides.length
    ) {
      return;
    }

    const copy =
      [...slides];

    const [item] =
      copy.splice(from, 1);

    copy.splice(
      to,
      0,
      item,
    );

    setSlides(
      reindex(copy),
    );

    /*
     * نغلق المعاينة والتعديل بعد
     * تغيير الترتيب حتى لا تتغير
     * أرقام العناصر المفتوحة.
     */
    setPreview(null);
    setEditing(null);
  };

  /*
   * تعديل بيانات شريحة معينة.
   */
  const patch = (
    index: number,
    patchData: Partial<Slide>,
  ) => {
    setSlides(
      slides.map(
        (slide, idx) =>
          idx === index
            ? {
                ...slide,
                ...patchData,
              }
            : slide,
      ),
    );
  };

  /*
   * عدد الشرائح في كل مرحلة.
   */
  const counts =
    slides.reduce<
      Record<string, number>
    >(
      (acc, slide) => {
        acc[slide.phase] =
          (acc[slide.phase] ??
            0) + 1;

        return acc;
      },
      {},
    );

  return (
    <div className="card-elevated p-4">
      <SharedFileBadge
        name={
          hasPdf
            ? sharedName
            : ""
        }
      />

      {/* اختيار PDF يدوياً */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file =
            e.target.files?.[0];

          e.target.value = "";

          if (!file) {
            return;
          }

          void (async () => {
            /*
             * ملف جديد:
             * نمسح صور وشرائح الملف السابق.
             */
            if (
              file.name !==
              sharedName
            ) {
              await clearFileArtifacts();
            }

            setLastPdfFile(file);

            await run(file);
          })();
        }}
      />

      {/* إنشاء العرض */}
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          background: PURPLE,
        }}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span>🎬</span>
        )}

        {busy
          ? isArabic
            ? "جارٍ البناء..."
            : "Building..."
          : isArabic
            ? "أنشئ عرضاً من صور الكتاب"
            : "Create Presentation from Book Pages"}
      </button>

      {!hasPdf &&
        !busy && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {isArabic
              ? "إن لم يكن الملف مرفوعاً من قسم «تحميل ملف الدرس»، اضغط الزر لاختيار ملف PDF مباشرة"
              : "If the file was not uploaded from the lesson upload section, click the button to choose a PDF directly."}
          </p>
        )}

      {/* تقدم بناء العرض */}
      {busy && (
        <div className="mt-4 rounded-lg border p-3">
          <div className="mb-2 text-sm font-bold">
            🔄{" "}
            {isArabic
              ? "جارٍ بناء العرض من الكتاب..."
              : "Building the presentation from the book..."}
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full transition-all"
              style={{
                width: `${
                  total
                    ? (done /
                        total) *
                      100
                    : 0
                }%`,
                background:
                  PURPLE,
              }}
            />
          </div>

          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>
              {status}
            </span>

            <span>
              {isArabic
                ? `${done} من ${total}`
                : `${done} of ${total}`}
            </span>
          </div>
        </div>
      )}

      {/* العرض جاهز */}
      {slides.length > 0 &&
        !busy && (
          <div className="mt-4 space-y-3">

            <div className="text-sm font-bold text-green-700">
              {isArabic
                ? `✅ تم بناء العرض — ${slides.length} شرائح`
                : `✅ Presentation created — ${slides.length} slides`}
            </div>

            {/* إحصائيات المراحل */}
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(
                counts,
              ).map(
                ([
                  phase,
                  count,
                ]) => (
                  <span
                    key={
                      phase
                    }
                    className="rounded-full px-3 py-1 font-bold text-white"
                    style={{
                      background:
                        PHASE_LABELS[
                          phase as Slide["phase"]
                        ]
                          ?.color ??
                        "#888",
                    }}
                  >
                    {phaseName(
                      phase as Slide["phase"],
                    )}{" "}
                    ×{count}
                  </span>
                ),
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {isArabic
                ? "اسحب الشرائح لإعادة الترتيب — أو استخدم الأسهم. اضغط «تعديل» لتغيير محتوى أي شريحة."
                : "Drag slides to reorder them, or use the arrows. Click Edit to change any slide."}
            </p>

            {/* قائمة الشرائح */}
            <ul className="space-y-2">
  {slides.map((slide, index) => {
    const isPreviewOpen = preview === index;
    const isEditingOpen = editing === index;

    return (
      <li
        key={`${slide.id}-${index}`}
        className={`rounded-lg border bg-card p-3 transition-colors ${
          isEditingOpen
            ? "border-primary/40 ring-1 ring-primary/10"
            : ""
        }`}
      >
        {/* =========================
            رأس الشريحة
        ========================= */}

        <div className="flex flex-wrap items-center gap-2">
          {/* المرحلة */}
          <span
            className="rounded px-2 py-0.5 text-[11px] font-bold text-white"
            style={{
              background:
                PHASE_LABELS[slide.phase]?.color ??
                "#888",
            }}
          >
            {phaseName(slide.phase)}
          </span>

          {/* اسم الشريحة */}
          <div className="min-w-0 flex-1 truncate px-1 text-sm font-bold text-primary">
            {slide.title ||
              (isArabic
                ? "بدون عنوان"
                : "Untitled Slide")}
          </div>

          {/* لأعلى */}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              move(index, index - 1);
            }}
            disabled={index === 0}
            className="rounded p-1 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={
              isArabic
                ? "تحريك لأعلى"
                : "Move Up"
            }
            title={
              isArabic
                ? "تحريك لأعلى"
                : "Move Up"
            }
          >
            <ChevronRight className="h-4 w-4 rotate-90" />
          </button>

          {/* لأسفل */}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              move(index, index + 1);
            }}
            disabled={
              index === slides.length - 1
            }
            className="rounded p-1 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={
              isArabic
                ? "تحريك لأسفل"
                : "Move Down"
            }
            title={
              isArabic
                ? "تحريك لأسفل"
                : "Move Down"
            }
          >
            <ChevronLeft className="h-4 w-4 rotate-90" />
          </button>

          {/* معاينة */}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              setPreview(
                isPreviewOpen
                  ? null
                  : index,
              );

              // فتح المعاينة يغلق التعديل
              if (!isPreviewOpen) {
                setEditing(null);
              }
            }}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              isPreviewOpen
                ? "bg-accent text-primary"
                : "hover:bg-accent"
            }`}
          >
            {isArabic
              ? isPreviewOpen
                ? "إغلاق المعاينة"
                : "معاينة"
              : isPreviewOpen
                ? "Close Preview"
                : "Preview"}
          </button>

          {/* تعديل */}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              if (isEditingOpen) {
                setEditing(null);
              } else {
                setEditing(index);

                // فتح التعديل يغلق المعاينة
                setPreview(null);
              }
            }}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold transition-colors ${
              isEditingOpen
                ? "bg-primary text-primary-foreground"
                : "text-primary hover:bg-accent"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />

            {isArabic
              ? isEditingOpen
                ? "إغلاق التعديل"
                : "تعديل"
              : isEditingOpen
                ? "Close Edit"
                : "Edit"}
          </button>

          {/* حذف */}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              removeSlide(index);
            }}
            className="rounded p-1 text-destructive hover:bg-destructive/10"
            aria-label={
              isArabic
                ? "حذف"
                : "Delete"
            }
            title={
              isArabic
                ? "حذف"
                : "Delete"
            }
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* =========================
            معاينة الشريحة
        ========================= */}

        {isPreviewOpen && (
          <div className="mt-3 rounded-lg border bg-muted/10 p-3">
            <div className="h-72">
              <SlideView
                slide={slide}
                index={index}
                count={slides.length}
                topic={plan.topic}
              />
            </div>
          </div>
        )}

        {/* =========================
            محرر الشريحة
        ========================= */}

{isEditingOpen && (
  <div
    className="mt-3 space-y-4 rounded-xl border border-primary/30 bg-muted/20 p-4"
    dir={isArabic ? "rtl" : "ltr"}
  >
    {/* =========================
        رأس محرر الشريحة
    ========================= */}

    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm font-black text-primary">
        <Pencil className="h-4 w-4" />

        {isArabic
          ? "تعديل الشريحة"
          : "Edit Slide"}
      </div>

      <span className="text-[11px] text-muted-foreground">
        {isArabic
          ? `الشريحة ${index + 1}`
          : `Slide ${index + 1}`}
      </span>
    </div>

    {/* =========================
        عنوان الشريحة
    ========================= */}

    <div>
      <label className="mb-1 block text-xs font-bold text-muted-foreground">
        {isArabic
          ? "عنوان الشريحة"
          : "Slide Title"}
      </label>

      <input
        type="text"
        value={slide.title ?? ""}
        onChange={(event) => {
          patch(index, {
            title: event.target.value,
          });
        }}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        placeholder={
          isArabic
            ? "اكتب عنوان الشريحة"
            : "Enter slide title"
        }
      />
    </div>

    {/* =========================
        شريحة الغلاف
    ========================= */}

    {slide.type === "cover" && (
      <div className="rounded-lg border border-dashed bg-background/60 p-3 text-xs text-muted-foreground">
        {isArabic
          ? "هذه شريحة الغلاف. يمكنك تعديل عنوانها وإضافة صورة لها."
          : "This is the cover slide. You can edit its title and add an image."}
      </div>
    )}

    {/* =========================
        نقاط الشريحة + السؤال
    ========================= */}

    {slide.type !== "cover" && (
      <>
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">
            {isArabic
              ? "نقاط الشريحة"
              : "Slide Points"}
          </label>

          <textarea
            value={(slide.points ?? []).join("\n")}
            onChange={(event) => {
              patch(index, {
                points:
                  event.target.value.split("\n"),
              });
            }}
            rows={5}
            placeholder={
              isArabic
                ? "اكتب كل نقطة في سطر منفصل"
                : "Write one point per line"
            }
            className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">
            {isArabic
              ? "السؤال التفاعلي"
              : "Interactive Question"}
          </label>

          <textarea
            value={slide.question ?? ""}
            onChange={(event) => {
              patch(index, {
                question:
                  event.target.value,
              });
            }}
            rows={2}
            placeholder={
              isArabic
                ? "اكتب سؤالاً تفاعلياً للطالب"
                : "Enter an interactive question"
            }
            className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </>
    )}

    {/* =========================
        الواجب
    ========================= */}

    {slide.type === "homework" && (
      <div>
        <label className="mb-1 block text-xs font-bold text-muted-foreground">
          {isArabic
            ? "محتوى الواجب المنزلي"
            : "Homework Content"}
        </label>

        <textarea
          value={slide.homework ?? ""}
          onChange={(event) => {
            patch(index, {
              homework:
                event.target.value,
            });
          }}
          rows={4}
          placeholder={
            isArabic
              ? "اكتب الواجب المنزلي"
              : "Enter homework content"
          }
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
    )}

    {/* =========================
        إضافة صورة للشريحة
    ========================= */}

    <div className="rounded-xl border bg-background/70 p-3">
      <label className="mb-2 block text-xs font-bold text-muted-foreground">
        {isArabic
          ? "صورة الشريحة"
          : "Slide Image"}
      </label>

      <p className="mb-3 text-[11px] text-muted-foreground">
        {isArabic
          ? "يمكنك إضافة صورة من جهازك لتظهر داخل هذه الشريحة."
          : "You can add an image from your device to this slide."}
      </p>

      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={(event) => {
          const file =
            event.target.files?.[0];

          /*
           * نسمح باختيار نفس الصورة مرة أخرى
           * بعد حذفها.
           */
          event.target.value = "";

          if (!file) {
            return;
          }

          /*
           * حماية بسيطة من الملفات الكبيرة جداً.
           * 8 MB كحد أقصى للصورة الواحدة.
           */
          const maxSize =
            8 * 1024 * 1024;

          if (file.size > maxSize) {
            toast.error(
              isArabic
                ? "حجم الصورة كبير جداً. اختر صورة أقل من 8 MB."
                : "The image is too large. Choose an image smaller than 8 MB.",
            );

            return;
          }

          /*
           * نتأكد أنها صورة.
           */
          if (
            !file.type.startsWith(
              "image/",
            )
          ) {
            toast.error(
              isArabic
                ? "الملف المختار ليس صورة."
                : "The selected file is not an image.",
            );

            return;
          }

          /*
           * تحويل الصورة إلى Data URL.
           *
           * مثال:
           * data:image/jpeg;base64,...
           *
           * بعدها نخزنها داخل نفس Slide.
           */
          const reader =
            new FileReader();

          reader.onload = () => {
            if (
              typeof reader.result !==
              "string"
            ) {
              return;
            }

            patch(index, {
              imageDataUrl:
                reader.result,
            });

            toast.success(
              isArabic
                ? "تمت إضافة الصورة إلى الشريحة"
                : "Image added to slide",
            );
          };

          reader.onerror = () => {
            toast.error(
              isArabic
                ? "تعذّر قراءة الصورة"
                : "Unable to read image",
            );
          };

          reader.readAsDataURL(file);
        }}
        className="block w-full cursor-pointer rounded-lg border bg-background px-3 py-2 text-xs"
      />

      {/* =========================
          معاينة الصورة المضافة
      ========================= */}

      {slide.imageDataUrl && (
        <div className="mt-4 rounded-xl border bg-card p-3">
          <div className="mb-2 text-xs font-bold text-primary">
            {isArabic
              ? "معاينة الصورة"
              : "Image Preview"}
          </div>

          <div className="flex justify-center rounded-lg bg-muted/30 p-2">
            <img
              src={slide.imageDataUrl}
              alt={
                slide.title ||
                (isArabic
                  ? "صورة الشريحة"
                  : "Slide image")
              }
              className="max-h-64 max-w-full rounded-lg object-contain"
            />
          </div>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {/* تغيير الصورة */}

            <label className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-accent">
              {isArabic
                ? "تغيير الصورة"
                : "Change Image"}

              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file =
                    event.target.files?.[0];

                  event.target.value = "";

                  if (!file) {
                    return;
                  }

                  const maxSize =
                    8 * 1024 * 1024;

                  if (
                    file.size >
                    maxSize
                  ) {
                    toast.error(
                      isArabic
                        ? "حجم الصورة كبير جداً. اختر صورة أقل من 8 MB."
                        : "The image is too large. Choose an image smaller than 8 MB.",
                    );

                    return;
                  }

                  const reader =
                    new FileReader();

                  reader.onload = () => {
                    if (
                      typeof reader.result ===
                      "string"
                    ) {
                      patch(index, {
                        imageDataUrl:
                          reader.result,
                      });
                    }
                  };

                  reader.onerror = () => {
                    toast.error(
                      isArabic
                        ? "تعذّر قراءة الصورة"
                        : "Unable to read image",
                    );
                  };

                  reader.readAsDataURL(
                    file,
                  );
                }}
              />
            </label>

            {/* حذف الصورة */}

            <button
              type="button"
              onClick={() => {
                patch(index, {
                  imageDataUrl:
                    undefined,
                });

                toast.success(
                  isArabic
                    ? "تم حذف الصورة من الشريحة"
                    : "Image removed from slide",
                );
              }}
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
            >
              {isArabic
                ? "حذف الصورة"
                : "Remove Image"}
            </button>
          </div>
        </div>
      )}
    </div>

    {/* =========================
        أزرار المحرر
    ========================= */}

    <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
      <button
        type="button"
        onClick={() => {
          setEditing(null);
          setPreview(index);
        }}
        className="rounded-lg border px-4 py-2 text-xs font-bold hover:bg-accent"
      >
        {isArabic
          ? "معاينة التعديل"
          : "Preview Changes"}
      </button>

      <button
        type="button"
        onClick={() => {
          setEditing(null);

          toast.success(
            isArabic
              ? "تم حفظ تعديلات الشريحة"
              : "Slide changes saved",
          );
        }}
        className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
      >
        {isArabic
          ? "تم ✓"
          : "Done ✓"}
      </button>
    </div>
  </div>
)}
      </li>
    );
  })}
</ul>

            {/* الأزرار الرئيسية */}
            <div className="flex flex-wrap gap-2">

              {/* شريحة فارغة */}
              <button
                type="button"
                onClick={
                  addBlank
                }
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
              >
                <Plus className="h-4 w-4" />

                {isArabic
                  ? "شريحة فارغة"
                  : "Blank Slide"}
              </button>

              {/* تحميل PowerPoint */}
              <button
                type="button"
                onClick={() =>
                  void downloadPptx()
                }
                disabled={
                  slides.length ===
                  0
                }
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {isArabic
                  ? "تحميل PowerPoint"
                  : "Download PowerPoint"}
              </button>

              {/* بدء العرض */}
              <a
                href="/presentation"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-bold text-white hover:opacity-90"
                style={{
                  background:
                    PURPLE,
                }}
              >
                <Play className="h-4 w-4" />

                {isArabic
                  ? "ابدأ العرض"
                  : "Start Presentation"}
              </a>
            </div>
          </div>
        )}
    </div>
  );
}