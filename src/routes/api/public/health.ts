import { createFileRoute } from "@tanstack/react-router";

/**
 * فحص اتصال مزودي الذكاء الاصطناعي بدون كشف قيم المفاتيح.
 * GET /api/public/health
 * GET /api/public/health?probe=1
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gemini = process.env["GEMINI_API_KEY"];
        const anthropic = process.env["ANTHROPIC_API_KEY"];
        const lovable = process.env["LOVABLE_API_KEY"];
        const unsplash = process.env["UNSPLASH_ACCESS_KEY"];

        const present = (v?: string) =>
          Boolean(v && v.trim().length > 0);

        const ai =
          present(gemini) ||
          present(anthropic) ||
          present(lovable);

        const geminiRaw = gemini ?? "";
        const anthropicRaw = anthropic ?? "";

        const geminiDiag = {
          present: present(gemini),
          length: geminiRaw.length,
          trimmedLength: geminiRaw.trim().length,
          hasSurroundingWhitespace:
            geminiRaw !== geminiRaw.trim(),
          hasQuotes: /^["']|["']$/.test(
            geminiRaw.trim()
          ),
          hasNewline: /[\r\n]/.test(geminiRaw),
        };

        const anthropicDiag = {
          present: present(anthropic),
          length: anthropicRaw.length,
          trimmedLength: anthropicRaw.trim().length,
          hasSurroundingWhitespace:
            anthropicRaw !== anthropicRaw.trim(),
          hasQuotes: /^["']|["']$/.test(
            anthropicRaw.trim()
          ),
          hasNewline: /[\r\n]/.test(anthropicRaw),
          startsWithExpectedPrefix:
            anthropicRaw
              .trim()
              .startsWith("sk-ant-"),
        };

        let probe: {
          attempted: boolean;
          provider?: string;
          status?: number;
          error?: string;
        } = {
          attempted: false,
        };

        const shouldProbe =
          new URL(request.url).searchParams.get(
            "probe"
          ) === "1";

        // Gemini probe — first priority
        if (shouldProbe && geminiDiag.present) {
          probe = {
            attempted: true,
            provider: "gemini",
          };

          try {
            const model =
              process.env["GEMINI_MODEL"]?.trim() ||
              "gemini-2.5-flash";

            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  "x-goog-api-key":
                    geminiRaw.trim(),
                },
                body: JSON.stringify({
                  contents: [
                    {
                      role: "user",
                      parts: [{ text: "ping" }],
                    },
                  ],
                  generationConfig: {
                    maxOutputTokens: 1,
                  },
                }),
              }
            );

            const text = await res.text();

            probe.status = res.status;

            if (!res.ok) {
              probe.error = text.slice(0, 200);
            }
          } catch (e) {
            probe.error =
              e instanceof Error
                ? e.message
                : String(e);
          }
        }

        // Anthropic fallback probe
        else if (
          shouldProbe &&
          anthropicDiag.present
        ) {
          probe = {
            attempted: true,
            provider: "anthropic",
          };

          try {
            const res = await fetch(
              "https://api.anthropic.com/v1/messages",
              {
                method: "POST",
                headers: {
                  "x-api-key":
                    anthropicRaw.trim(),
                  "anthropic-version":
                    "2023-06-01",
                  "content-type":
                    "application/json",
                },
                body: JSON.stringify({
                  model:
                    process.env[
                      "ANTHROPIC_MODEL"
                    ]?.trim() ||
                    "claude-sonnet-4-5",
                  max_tokens: 1,
                  messages: [
                    {
                      role: "user",
                      content: "ping",
                    },
                  ],
                }),
              }
            );

            const text = await res.text();

            probe.status = res.status;

            if (!res.ok) {
              probe.error = text.slice(0, 200);
            }
          } catch (e) {
            probe.error =
              e instanceof Error
                ? e.message
                : String(e);
          }
        }

        const provider = present(gemini)
          ? "gemini"
          : present(anthropic)
            ? "anthropic"
            : present(lovable)
              ? "lovable"
              : "none";

        const body = {
          ok: ai,
          provider,

          keys: {
            GEMINI_API_KEY: geminiDiag,

            ANTHROPIC_API_KEY:
              anthropicDiag,

            LOVABLE_API_KEY: {
              present: present(lovable),
              length: lovable
                ? lovable.length
                : 0,
            },

            UNSPLASH_ACCESS_KEY: {
              present: present(unsplash),
              length: unsplash
                ? unsplash.length
                : 0,
            },
          },

          probe,
          checkedAt: new Date().toISOString(),
        };

        return Response.json(body, {
          status: ai ? 200 : 503,

          headers: {
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});