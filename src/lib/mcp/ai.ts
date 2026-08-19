// Shared AI caller for MCP tools.
//
// Priority:
// 1. Gemini directly when GEMINI_API_KEY is available.
// 2. Anthropic as an optional fallback.
// 3. Lovable AI Gateway as a final fallback.

export async function callGateway(
  system: string,
  user: string
): Promise<string> {
  // --------------------------------------------------
  // 1. Google Gemini
  // --------------------------------------------------

  const geminiKey = process.env.GEMINI_API_KEY
    ?.trim()
    .replace(/^["']|["']$/g, "");

  if (geminiKey) {
    const model =
      process.env.GEMINI_MODEL?.trim() ||
      "gemini-3.5-flash-lite";

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: system }],
          },

          contents: [
            {
              role: "user",
              parts: [{ text: user }],
            },
          ],

          generationConfig: {
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (res.status === 429) {
      throw new Error(
        "تم تجاوز حد طلبات الذكاء الاصطناعي. حاول بعد قليل."
      );
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "تعذّر التحقق من خدمة الذكاء الاصطناعي."
      );
    }

    if (!res.ok) {
      const detail = await res.text();

      console.error(
        "Gemini API error:",
        res.status,
        detail.slice(0, 500)
      );

      throw new Error(
        `تعذّر الاتصال بالذكاء الاصطناعي (${res.status})`
      );
    }

    const json = (await res.json()) as {
      candidates?: {
        content?: {
          parts?: {
            text?: string;
          }[];
        };
      }[];
    };

    const text =
      json.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!text) {
      throw new Error(
        "لم تُعد خدمة الذكاء الاصطناعي أي محتوى."
      );
    }

    return text;
  }

  // --------------------------------------------------
  // 2. Anthropic fallback
  // --------------------------------------------------

  const anthropicKey = process.env.ANTHROPIC_API_KEY
    ?.trim()
    .replace(/^["']|["']$/g, "");

  if (anthropicKey) {
    const res = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },

        body: JSON.stringify({
          model:
            process.env.ANTHROPIC_MODEL?.trim() ||
            "claude-sonnet-4-5",

          max_tokens: 4096,

          system,

          messages: [
            {
              role: "user",
              content: user,
            },
          ],
        }),
      }
    );

    if (res.status === 429) {
      throw new Error(
        "تم تجاوز حد الطلبات. حاول بعد قليل."
      );
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "تعذّر التحقق من خدمة الذكاء الاصطناعي."
      );
    }

    if (!res.ok) {
      throw new Error(
        `تعذّر الاتصال بالذكاء الاصطناعي (${res.status})`
      );
    }

    const json = (await res.json()) as {
      content?: {
        type?: string;
        text?: string;
      }[];
    };

    return (
      json.content
        ?.filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("")
        .trim() ?? ""
    );
  }

  // --------------------------------------------------
  // 3. Lovable fallback
  // --------------------------------------------------

  const lovableKey = process.env.LOVABLE_API_KEY;

  if (!lovableKey) {
    throw new Error(
      "خدمة الذكاء الاصطناعي غير مفعّلة على الخادم."
    );
  }

  const res = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
      },

      body: JSON.stringify({
        model: "google/gemini-3.6-flash",

        messages: [
          {
            role: "system",
            content: system,
          },
          {
            role: "user",
            content: user,
          },
        ],
      }),
    }
  );

  if (res.status === 429) {
    throw new Error(
      "تم تجاوز حد الطلبات. حاول بعد قليل."
    );
  }

  if (res.status === 402) {
    throw new Error(
      "انتهت أرصدة خدمة الذكاء الاصطناعي."
    );
  }

  if (!res.ok) {
    throw new Error(
      `تعذّر الاتصال بالذكاء الاصطناعي (${res.status})`
    );
  }

  const json = (await res.json()) as {
    choices?: {
      message?: {
        content?: string;
      };
    }[];
  };

  const text =
    json.choices?.[0]?.message?.content?.trim() ?? "";

  if (!text) {
    throw new Error(
      "لم تُعد خدمة الذكاء الاصطناعي أي محتوى."
    );
  }

  return text;
}