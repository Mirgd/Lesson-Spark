import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { setResponseStatus } from "@tanstack/react-start/server";
import { encodeAiError } from "@/lib/ai-error";

const Input = z.object({
  query: z.string().min(1),
  perPage: z.number().min(1).max(12).optional(),
});

export interface UnsplashImage {
  id: string;
  thumb: string;
  url: string;
  alt: string;
  author: string;
  authorUrl: string;
  link: string;
}

export const searchUnsplash = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<{ results: UnsplashImage[] }> => {
    const fail = (status: number, message: string, detail: string): never => {
      setResponseStatus(status >= 400 && status <= 599 ? status : 502);
      throw new Error(encodeAiError({ status, message, detail }));
    };

    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key)
      fail(
        503,
        "مفتاح صور Unsplash غير مضبوط على الخادم. أضف المتغير UNSPLASH_ACCESS_KEY في لوحة بيئة الاستضافة ثم أعد النشر.",
        "UNSPLASH_ACCESS_KEY is not set in the server environment",
      );
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", data.query);
    url.searchParams.set("per_page", String(data.perPage ?? 6));
    url.searchParams.set("content_filter", "high");
    url.searchParams.set("orientation", "landscape");
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${key}`,
        "Accept-Version": "v1",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401)
        fail(401, "مفتاح صور Unsplash مرفوض. تحقّق من قيمته في إعدادات بيئة الاستضافة.", body);
      if (res.status === 403)
        fail(403, "تم تجاوز حد طلبات صور Unsplash. انتظر قليلاً ثم أعد المحاولة.", body);
      fail(res.status, `تعذّر البحث عن الصور (رمز ${res.status}). أعد المحاولة بعد قليل.`, body);
    }
    const json = (await res.json()) as {
      results?: Array<{
        id: string;
        urls: { small: string; regular: string };
        alt_description?: string | null;
        description?: string | null;
        links: { html: string };
        user: { name: string; links: { html: string } };
      }>;
    };
    const results = (json.results ?? []).map((r) => ({
      id: r.id,
      thumb: r.urls.small,
      url: r.urls.regular,
      alt: r.alt_description || r.description || data.query,
      author: r.user.name,
      authorUrl: r.user.links.html,
      link: r.links.html,
    }));
    return { results };
  });
