import { isBookImage, type PhaseImage } from "@/lib/lesson-types";
import { BookPageImage } from "./BookPageImage";

/**
 * عرض صور المرحلة — الأولوية: صور الكتاب أولاً ثم صور الإنترنت.
 * لا تُعرض أي صورة إن لم يختر المعلم شيئاً.
 */
export function PhaseImages({
  images,
  className = "",
  dark = false,
}: {
  images?: PhaseImage[];
  className?: string;
  dark?: boolean;
}) {
  if (!images || images.length === 0) return null;
  const ordered = [...images].sort((a, b) => Number(isBookImage(b)) - Number(isBookImage(a)));
  const caption = dark ? "text-white/60" : "text-muted-foreground";

  return (
    <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${className}`}>
      {ordered.map((img) =>
        isBookImage(img) ? (
          <figure key={img.id} className="m-0 overflow-hidden rounded-lg border bg-white">
            <BookPageImage page={img.page} className="aspect-[3/4] w-full object-contain" />
            <figcaption className={`px-2 py-1 text-center text-[11px] ${caption}`}>
              صفحة {img.page} من كتاب الطالب
            </figcaption>
          </figure>
        ) : (
          <figure key={img.id} className="m-0 overflow-hidden rounded-lg border">
            <a href={img.link} target="_blank" rel="noreferrer">
              <img
                src={img.url}
                alt={img.alt}
                className="aspect-video w-full object-cover"
                loading="lazy"
              />
            </a>
            <figcaption className={`px-2 py-1 text-center text-[11px] ${caption}`}>
              Unsplash · {img.author}
            </figcaption>
          </figure>
        ),
      )}
    </div>
  );
}
