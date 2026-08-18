// Shared AI caller for MCP tools.
// Uses Anthropic directly when ANTHROPIC_API_KEY is set (works on any host),
// and falls back to the Lovable AI Gateway otherwise.

export async function callGateway(system: string, user: string): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5",
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (res.status === 429) throw new Error("تم تجاوز حد الطلبات. حاول بعد قليل.");
    if (res.status === 401 || res.status === 403) throw new Error("مفتاح Anthropic مرفوض.");
    if (!res.ok) throw new Error(`تعذّر الاتصال بالذكاء الاصطناعي (${res.status})`);

    const json = (await res.json()) as { content?: { type?: string; text?: string }[] };
    return json.content?.filter((p) => p.type === "text").map((p) => p.text ?? "").join("") ?? "";
  }

  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (res.status === 429) throw new Error("تم تجاوز حد الطلبات. حاول بعد قليل.");
  if (res.status === 402) throw new Error("انتهت الأرصدة. أضف رصيداً من إعدادات الحساب.");
  if (!res.ok) throw new Error(`تعذّر الاتصال بالذكاء الاصطناعي (${res.status})`);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}
