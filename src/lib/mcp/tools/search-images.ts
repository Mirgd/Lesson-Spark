import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

interface UnsplashPhoto {
  id: string;
  urls: { small: string; regular: string };
  alt_description?: string | null;
  description?: string | null;
  links: { html: string };
  user: { name: string };
}

export default defineTool({
  name: "search_lesson_images",
  title: "Search teaching images",
  description:
    "Search Unsplash for landscape, classroom-safe photos to illustrate a lesson phase. Returns image URLs with attribution.",
  inputSchema: {
    query: z.string().min(1).describe("Search terms in English, e.g. 'photosynthesis leaf'."),
    perPage: z.number().int().min(1).max(12).describe("How many images to return (1-12)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ query, perPage }) => {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) {
      return {
        content: [{ type: "text", text: "Image search is not configured (missing Unsplash key)." }],
        isError: true,
      };
    }

    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("content_filter", "high");
    url.searchParams.set("orientation", "landscape");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    });
    if (!res.ok) {
      return {
        content: [{ type: "text", text: `Image search failed (${res.status}).` }],
        isError: true,
      };
    }

    const json = (await res.json()) as { results?: UnsplashPhoto[] };
    const results = (json.results ?? []).map((r) => ({
      id: r.id,
      url: r.urls.regular,
      thumb: r.urls.small,
      alt: r.alt_description || r.description || query,
      author: r.user.name,
      link: r.links.html,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      structuredContent: { results },
    };
  },
});
