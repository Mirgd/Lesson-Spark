import { useEffect, useState } from "react";
import { getPageImage } from "@/lib/presentation";

/** يعرض صفحة من الكتاب المرفوع (مخزّنة في IndexedDB — لا في localStorage) */
export function BookPageImage({
  page,
  className = "",
  alt,
}: {
  page: number;
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPageImage(page)
      .then((v) => alive && setSrc(v))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [page]);

  if (!src)
    return (
      <div
        className={`flex items-center justify-center bg-muted text-[11px] text-muted-foreground ${className}`}
      >
        صفحة {page}
      </div>
    );

  return (
    <img
      src={src}
      alt={alt ?? `صفحة ${page} من كتاب الطالب`}
      className={className}
      loading="lazy"
    />
  );
}
