import { createFileRoute } from "@tanstack/react-router";

/**
 * فحص اتصال: يعيد ما إذا كانت مفاتيح البيئة مقروءة على الخادم — دون كشف قيمها.
 * GET /api/public/health
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const anthropic = process.env["ANTHROPIC_API_KEY"];
        const lovable = process.env["LOVABLE_API_KEY"];
        const unsplash = process.env["UNSPLASH_ACCESS_KEY"];
        const present = (v?: string) => Boolean(v && v.trim().length > 0);
        const ai = present(anthropic) || present(lovable);

        // تشخيص آمن للمفتاح: شكله وسلامته دون كشف أي حرف من قيمته
        const raw = anthropic ?? "";
        const diag = {
          present: present(anthropic),
          length: raw.length,
          trimmedLength: raw.trim().length,
          hasSurroundingWhitespace: raw !== raw.trim(),
          hasQuotes: /^["']|["']$/.test(raw.trim()),
          hasNewline: /[\r\n]/.test(raw),
          startsWithExpectedPrefix: raw.trim().startsWith("sk-ant-"),
        };

        // فحص حقيقي أمام Anthropic عند إضافة ?probe=1 — يوضح سبب 401 بدقة
        let probe: { attempted: boolean; status?: number; error?: string } = { attempted: false };
        if (new URL(request.url).searchParams.get("probe") === "1" && diag.present) {
          probe = { attempted: true };
          try {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": raw.trim(),
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
              body: JSON.stringify({
                model: process.env["ANTHROPIC_MODEL"]?.trim() || "claude-sonnet-4-5",
                max_tokens: 1,
                messages: [{ role: "user", content: "ping" }],
              }),
            });
            const text = await res.text();
            probe.status = res.status;
            if (!res.ok) probe.error = text.slice(0, 200);
          } catch (e) {
            probe.error = e instanceof Error ? e.message : String(e);
          }
        }

        const body = {
          ok: ai,
          provider: present(anthropic) ? "anthropic" : present(lovable) ? "lovable" : "none",
          keys: {
            ANTHROPIC_API_KEY: diag,
            LOVABLE_API_KEY: { present: present(lovable), length: lovable ? lovable.length : 0 },
            UNSPLASH_ACCESS_KEY: { present: present(unsplash), length: unsplash ? unsplash.length : 0 },
          },
          probe,
          checkedAt: new Date().toISOString(),
        };
        return Response.json(body, {
          status: ai ? 200 : 503,
          headers: { "Cache-Control": "no-store" },
        });
      },

    },
  },
});
