import { setResponseStatus } from "@tanstack/react-start/server";
import { generateText, type ModelMessage } from "ai"; 
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { encodeAiError } from "@/lib/ai-error";

export interface AiCallOptions {
  messages: unknown[];
  model?: string;
  maxTokens?: number;
}


function messageFor(status: number, body: string): string {
  if (status === 401 || status === 403) return "مفتاح الذكاء الاصطناعي مرفوض من الخدمة.";
  if (status === 402) return "انتهى رصيد الذكاء الاصطناعي. أضف رصيداً ثم أعد المحاولة.";
  if (status === 429) return "تم تجاوز حد الطلبات. انتظر دقيقة ثم أعد المحاولة.";
  if (status === 400) return "رفضت خدمة الذكاء الاصطناعي الطلب. قلّل حجم الملف ثم أعد المحاولة.";
  if (status === 404) return "نموذج الذكاء الاصطناعي غير متاح حالياً.";
  if (status >= 500) return "خدمة الذكاء الاصطناعي غير متاحة مؤقتاً. أعد المحاولة بعد دقيقة.";
  return `تعذّر إتمام النداء (رمز ${status}). ${body.slice(0, 120)}`.trim();
}

function statusFrom(error: unknown): number {
  if (!error || typeof error !== "object") return 502;
  const value = Number((error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status);
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : 502;
}

function fail(status: number, message: string, detail: string): never {
  setResponseStatus(status >= 400 && status <= 599 ? status : 502);
  throw new Error(encodeAiError({ status, message, detail }));
}

/** يحوّل رسائل بصيغة OpenAI إلى صيغة AI SDK: يفصل رسائل النظام ويصحّح أجزاء الصور. */
function normalize(messages: unknown[]): { instructions: string; messages: ModelMessage[] } {
  const systems: string[] = [];
  const rest: ModelMessage[] = [];

  for (const raw of messages) {
    const msg = raw as { role?: string; content?: unknown };
    if (msg.role === "system") {
      if (typeof msg.content === "string") systems.push(msg.content);
      continue;
    }
    let content = msg.content;
    if (Array.isArray(content)) {
      content = content.map((part) => {
        const p = part as { type?: string; image_url?: { url?: string }; text?: string };
        if (p.type === "image_url" && p.image_url?.url) return { type: "image", image: p.image_url.url };
        return part;
      });
    }
    rest.push({ role: (msg.role as "user" | "assistant") ?? "user", content } as ModelMessage);
  }

  return { instructions: systems.join("\n\n"), messages: rest };
}

/** يحوّل أجزاء الرسالة إلى صيغة Anthropic (نص + صور base64 أو رابط). */
function toAnthropicContent(content: unknown): unknown {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");
  return content.map((part) => {
    const p = part as { type?: string; text?: string; image?: unknown; image_url?: { url?: string } };
    if (p.type === "text") return { type: "text", text: p.text ?? "" };
    const url = p.image_url?.url ?? (typeof p.image === "string" ? p.image : undefined);
    if (url) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(url);
      if (match) return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
      return { type: "image", source: { type: "url", url } };
    }
    return { type: "text", text: p.text ?? "" };
  });
}
function toGeminiParts(content: unknown): unknown[] {
  if (typeof content === "string") {
    return [{ text: content }];
  }

  if (!Array.isArray(content)) {
    return [{ text: String(content ?? "") }];
  }

  return content.map((part) => {
    const p = part as {
      type?: string;
      text?: string;
      image?: unknown;
      image_url?: { url?: string };
    };

    if (p.type === "text") {
      return { text: p.text ?? "" };
    }

    const url =
      p.image_url?.url ??
      (typeof p.image === "string" ? p.image : undefined);

    if (url) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(url);

      if (match) {
        return {
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        };
      }

      // Keep URL as text for now if it is not base64.
      return { text: `Image URL: ${url}` };
    }

    return { text: p.text ?? "" };
  });
}
// ---------- Gemini global rate limiter ----------

const GEMINI_MIN_INTERVAL_MS = 13_000;

let lastGeminiRequestAt = 0;

let geminiQueue: Promise<void> = Promise.resolve();

async function waitForGeminiSlot(): Promise<void> {
  const previous = geminiQueue;

  let release!: () => void;

  geminiQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  const now = Date.now();

  const waitMs = Math.max(
    0,
    GEMINI_MIN_INTERVAL_MS - (now - lastGeminiRequestAt)
  );

  if (waitMs > 0) {
    console.log(
      `Gemini rate limiter: waiting ${waitMs}ms before next request.`
    );

    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  lastGeminiRequestAt = Date.now();

  release();
}
async function callGemini(
  key: string,
  opts: AiCallOptions
): Promise<string> {
  const { instructions, messages } = normalize(opts.messages);

  const model =
    process.env["GEMINI_MODEL"]?.trim() ||
    "gemini-3.5-flash-lite";

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: toGeminiParts(m.content),
  }));

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body = JSON.stringify({
    ...(instructions
      ? {
          systemInstruction: {
            parts: [{ text: instructions }],
          },
        }
      : {}),
    contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 4096,
    },
  });

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response;

    try {
      await waitForGeminiSlot();

      res = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "content-type": "application/json",
        },
        body,
      });
    } catch (error) {
      if (attempt < maxAttempts) {
        await sleep(5000);
        continue;
      }

      const detail =
        error instanceof Error
          ? error.message
          : String(error);

      return fail(
        502,
        "تعذّر الاتصال بخدمة الذكاء الاصطناعي.",
        detail
      );
    }

    // نجاح الطلب
    if (res.ok) {
      const json = (await res.json()) as {
        candidates?: {
          content?: {
            parts?: { text?: string }[];
          };
        }[];
      };

      const text =
        json.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim() ?? "";

      if (!text) {
        return fail(
          502,
          "لم تُعد خدمة الذكاء الاصطناعي أي محتوى.",
          "Empty Gemini response"
        );
      }

      return text;
    }

    // فشل الطلب
    const detail = (await res.text()).slice(0, 1000);

    const retryable =
      res.status === 500 ||
      res.status === 502 ||
      res.status === 503 ||
      res.status === 504;

    // إعادة المحاولة إذا كانت المشكلة مؤقتة
    if (retryable && attempt < maxAttempts) {
      const retryAfter = res.headers.get("retry-after");

      const retryAfterHeaderMs =
        retryAfter && !Number.isNaN(Number(retryAfter))
          ? Number(retryAfter) * 1000
          : 0;

      // مثال من Gemini:
      // "Please retry in 57.053665594s."
      const retryMatch = detail.match(
        /please retry in\s+([\d.]+)s/i
      );

      const retryAfterBodyMs = retryMatch
        ? Math.ceil(Number(retryMatch[1]) * 1000)
        : 0;

      const fallbackDelay = 15000;

      const delay =
        Math.max(
          retryAfterHeaderMs,
          retryAfterBodyMs,
          fallbackDelay
        ) + 1000;

      console.warn(
        `Gemini returned ${res.status}. Retrying attempt ${
          attempt + 1
        }/${maxAttempts} after ${delay}ms.`,
        detail
      );

      await sleep(delay);
      continue;
    }

    return fail(
      res.status,
      messageFor(res.status, detail),
      detail
    );
  }

  return fail(
    502,
    "تعذّر الاتصال بخدمة الذكاء الاصطناعي.",
    "Gemini retries exhausted"
  );
}
/** نداء مباشر لـ Anthropic — نفس الطلب الذي ينجح في /api/public/health?probe=1 */
async function callAnthropic(key: string, opts: AiCallOptions): Promise<string> {
  const { instructions, messages } = normalize(opts.messages);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env["ANTHROPIC_MODEL"]?.trim() || "claude-sonnet-4-5",
      max_tokens: opts.maxTokens ?? 4096,
      ...(instructions ? { system: instructions } : {}),
      messages: messages.map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 400);
    fail(res.status, messageFor(res.status, detail), detail);
  }

  const json = (await res.json()) as { content?: { type?: string; text?: string }[] };
  const text = (json.content ?? []).filter((p) => p.type === "text").map((p) => p.text ?? "").join("").trim();
  if (!text) fail(502, "لم تُعد خدمة الذكاء الاصطناعي أي محتوى.", "Empty AI response");
  return text;
}

function lovableModel(requested?: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey)
    fail(
      503,
      "خدمة الذكاء الاصطناعي غير مفعّلة على الخادم.",
      "Missing AI provider configuration",
    );

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  return provider(requested ?? "google/gemini-3.6-flash");
}

export async function callAiGateway(opts: AiCallOptions): Promise<string> {
  const geminiKey = process.env["GEMINI_API_KEY"]
    ?.trim()
    .replace(/^["']|["']$/g, "");

  // الأولوية لـ Gemini
  if (geminiKey) {
    return callGemini(geminiKey, opts);
  }

  // إذا لم يوجد Gemini، جرّب Anthropic
  const anthropicKey = process.env["ANTHROPIC_API_KEY"]
    ?.trim()
    .replace(/^["']|["']$/g, "");

  if (anthropicKey) {
    return callAnthropic(anthropicKey, opts);
  }

  // الخيار الأخير: Lovable AI Gateway
  const model = lovableModel(opts.model);
  const { instructions, messages } = normalize(opts.messages);

  try {
    const result = await generateText({
      model,
      ...(instructions ? { system: instructions } : {}),
      messages,
      maxOutputTokens: opts.maxTokens ?? 4096,
    });

    const content = result.text.trim();

    if (!content) {
      fail(
        502,
        "لم تُعد خدمة الذكاء الاصطناعي أي محتوى.",
        "Empty AI response"
      );
    }

    return content;
  } catch (error) {
    const status = statusFrom(error);
    const detail = error instanceof Error ? error.message : String(error);
    fail(status, messageFor(status, detail), detail);
  }
}


export function failParse(raw: string): never {
  fail(502, "تعذّر فهم ناتج الذكاء الاصطناعي. أعد المحاولة.", raw);
}
