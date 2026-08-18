import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Trash2, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchUnsplash } from "@/lib/unsplash.functions";
import { describePageKeywords } from "@/lib/vision.functions";
import { getPageImage, listPageNumbers, putPageImage } from "@/lib/presentation";
import { extractPdfAsImages, getLastPdfFile, useSharedFile } from "@/lib/pdf-images";
import { isBookImage, type PhaseImage, type WebImage } from "@/lib/lesson-types";
import { BookPageImage } from "./BookPageImage";
import { reportAiError } from "@/lib/ai-error";

const PER_PAGE = 9;

export function PhaseImagePicker({
  images,
  onChange,
  topic,
  subject,
}: {
  images: PhaseImage[];
  onChange: (imgs: PhaseImage[]) => void;
  topic: string;
  subject: string;
}) {
  const [tab, setTab] = useState<"book" | "web">("book");

  /* ---------- صور الكتاب ---------- */
  const [pages, setPages] = useState<number[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const { name: sharedName } = useSharedFile();
  const [hasPdf, setHasPdf] = useState(false);


  const syncPages = useCallback(async () => {
    setHasPdf(Boolean(getLastPdfFile()));
    try {
      setPages(await listPageNumbers());
    } catch {
      setPages([]);
    }
  }, []);

  useEffect(() => {
    syncPages();
    const h = () => syncPages();
    window.addEventListener("rz-pdf-file", h);
    return () => window.removeEventListener("rz-pdf-file", h);
  }, [syncPages]);

  const extractPages = async () => {
    const file = getLastPdfFile();
    if (!file) {
      toast.warning("ارفع ملف المقرر أولاً");
      return;
    }
    setExtracting(true);
    try {
      const imgs = await extractPdfAsImages(file, 15);
      for (const p of imgs) await putPageImage(p.page, p.dataUrl);
      await syncPages();
      toast.success(`تم تجهيز ${imgs.length} صفحة من الكتاب`);
    } catch (e) {
      toast.error(reportAiError(e, "صور المراحل", "تعذّر استخراج صور الكتاب"));
    } finally {
      setExtracting(false);
    }
  };

  useEffect(() => {
    if (hasPdf && pages.length === 0 && !extracting) extractPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPdf]);

  const visible = pages.slice(pageIndex * PER_PAGE, pageIndex * PER_PAGE + PER_PAGE);
  const maxIndex = Math.max(0, Math.ceil(pages.length / PER_PAGE) - 1);

  const selectedBookPage = images.find(isBookImage)?.page ?? null;

  const toggleBook = (page: number) => {
    const id = `book-${page}`;
    const exists = images.some((i) => i.id === id);
    onChange(
      exists
        ? images.filter((i) => i.id !== id)
        : [...images, { source: "book" as const, id, page }],
    );
  };

  /* ---------- صور الإنترنت ---------- */
  const search = useServerFn(searchUnsplash);
  const describe = useServerFn(describePageKeywords);
  const [results, setResults] = useState<WebImage[]>([]);
  const [webLoading, setWebLoading] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");

  const runSearch = async (query: string) => {
    setWebLoading(true);
    try {
      const { results: r } = await search({ data: { query, perPage: 9 } });
      setResults(r);
      setLastQuery(query);
      if (r.length === 0) toast.info("لا نتائج — جرّب كلمات أخرى");
    } catch (e) {
      toast.error(reportAiError(e, "صور المراحل", "تعذّر البحث"));
    } finally {
      setWebLoading(false);
    }
  };

  const smartSearch = async () => {
    setWebLoading(true);
    try {
      let keywords = "";
      if (selectedBookPage != null) {
        const dataUrl = await getPageImage(selectedBookPage);
        const base64 = dataUrl?.split(",")[1];
        const r = await describe({
          data: { imageBase64: base64, topic, subject },
        });
        keywords = r.keywords;
      } else {
        const r = await describe({ data: { topic, subject } });
        keywords = r.keywords;
      }
      await runSearch(`${keywords} science education diagram`);
    } catch (e) {
      toast.error(reportAiError(e, "صور المراحل", "تعذّر البحث"));
      setWebLoading(false);
    }
  };

  const toggleWeb = (img: WebImage) => {
    const exists = images.some((i) => i.id === img.id);
    onChange(
      exists ? images.filter((i) => i.id !== img.id) : [...images, { ...img, source: "unsplash" }],
    );
  };

  const remove = (id: string) => onChange(images.filter((i) => i.id !== id));

  /* ---------- الواجهة ---------- */
  const tabCls = (active: boolean) =>
    `flex-1 rounded-t-lg px-3 py-2 text-[13px] font-bold transition-colors ${
      active ? "bg-card text-primary shadow-[inset_0_-3px_0_var(--gold)]" : "bg-muted text-muted-foreground hover:text-primary"
    }`;

  return (
    <div className="mt-4 rounded-xl border-[1.5px] border-[#CBD5E0] bg-card p-3">
      <div className="mb-2 text-sm font-bold text-primary">
        📸 الصور التوضيحية{" "}
        {images.length > 0 && <span className="text-xs text-gold">({images.length})</span>}
      </div>

      <div className="flex gap-1 border-b border-[#CBD5E0]">
        <button type="button" className={tabCls(tab === "book")} onClick={() => setTab("book")}>
          📖 من الكتاب
        </button>
        <button type="button" className={tabCls(tab === "web")} onClick={() => setTab("web")}>
          🌐 صور مشابهة من النت
        </button>
      </div>

      {tab === "book" && (
        <div className="pt-3">
          {sharedName && (
            <div className="mb-2 rounded-lg border border-green-600/30 bg-green-50/40 p-2 text-[11px] font-bold text-green-800 dark:bg-green-950/20 dark:text-green-300">
              ✅ يستخدم ملف: <span className="font-medium">{sharedName}</span>
            </div>
          )}

          {extracting ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> جارٍ تجهيز صور الكتاب...
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 p-5 text-center">
              <ArrowUp className="h-5 w-5 animate-bounce text-gold" />
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                ارفع ملف المقرر أعلاه
                <br />
                لتظهر هنا صور كتابك المدرسي
              </p>
              {hasPdf && (
                <button
                  type="button"
                  onClick={extractPages}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  استخرج صور الكتاب الآن
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {visible.map((p) => {
                  const selected = images.some((i) => i.id === `book-${p}`);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleBook(p)}
                      className={`relative overflow-hidden rounded-md border-2 transition-all ${
                        selected ? "border-gold ring-2 ring-gold/40" : "border-transparent hover:border-muted-foreground/40"
                      }`}
                    >
                      <BookPageImage page={p} className="aspect-[3/4] w-full bg-white object-contain" />
                      <span className="block bg-primary/90 py-0.5 text-[11px] font-bold text-white">
                        صفحة {p}
                      </span>
                      {selected && (
                        <span className="absolute end-1 top-1 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-white">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {maxIndex > 0 && (
                <div className="mt-2 flex items-center justify-center gap-3 text-sm">
                  <button
                    type="button"
                    disabled={pageIndex === 0}
                    onClick={() => setPageIndex((i) => i - 1)}
                    className="rounded p-1 disabled:opacity-30"
                    aria-label="السابق"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-muted-foreground">
                    صفحة {pageIndex * PER_PAGE + 1}-{Math.min(pages.length, (pageIndex + 1) * PER_PAGE)} من{" "}
                    {pages.length}
                  </span>
                  <button
                    type="button"
                    disabled={pageIndex >= maxIndex}
                    onClick={() => setPageIndex((i) => i + 1)}
                    className="rounded p-1 disabled:opacity-30"
                    aria-label="التالي"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "web" && (
        <div className="space-y-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 text-[13px] font-medium text-muted-foreground">
              {selectedBookPage != null
                ? `صور مشابهة للصفحة ${selectedBookPage}`
                : `صور عن: ${topic.trim() || "موضوع الدرس"}`}
            </p>
            <button
              type="button"
              onClick={smartSearch}
              disabled={webLoading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {webLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              ابحث تلقائياً
            </button>
          </div>

          {results.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {results.map((img) => {
                const selected = images.some((i) => i.id === img.id);
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => toggleWeb(img)}
                    title={img.alt}
                    className={`relative aspect-video overflow-hidden rounded-md border-2 transition-all ${
                      selected ? "border-gold ring-2 ring-gold/40" : "border-transparent hover:border-muted-foreground/40"
                    }`}
                  >
                    <img src={img.thumb} alt={img.alt} className="h-full w-full object-cover" loading="lazy" />
                    {selected && (
                      <span className="absolute end-1 top-1 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <input
              className="w-full rounded-[10px] border-[1.5px] border-[#CBD5E0] bg-background px-3 py-2 text-sm outline-none focus:border-[var(--gold)]"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (manualQuery.trim()) runSearch(manualQuery.trim());
                }
              }}
              placeholder="🔍 ابحث عن شيء آخر..."
            />
            <button
              type="button"
              disabled={webLoading || !manualQuery.trim()}
              onClick={() => runSearch(manualQuery.trim())}
              className="shrink-0 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-medium text-gold disabled:opacity-50"
            >
              بحث
            </button>
          </div>

          <p className="m-0 text-[10px] text-muted-foreground">
            {lastQuery && <span className="me-2">كلمات البحث: {lastQuery}</span>}
            المصدر: Unsplash · للاستخدام التعليمي
          </p>
        </div>
      )}

      {images.length > 0 && (
        <div className="mt-3 border-t border-dashed pt-3">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            🖼 صور المرحلة (تظهر للطالب وفي العرض):
          </div>
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <div key={img.id} className="relative overflow-hidden rounded-md border">
                {isBookImage(img) ? (
                  <BookPageImage page={img.page} className="aspect-video w-full bg-white object-contain" />
                ) : (
                  <img src={img.thumb} alt={img.alt} className="aspect-video w-full object-cover" />
                )}
                <span className="block bg-muted py-0.5 text-center text-[10px] text-muted-foreground">
                  {isBookImage(img) ? `صفحة ${img.page} من كتاب الطالب` : `Unsplash · ${img.author}`}
                </span>
                <button
                  type="button"
                  onClick={() => remove(img.id)}
                  className="absolute end-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-red-600"
                  aria-label="حذف"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
