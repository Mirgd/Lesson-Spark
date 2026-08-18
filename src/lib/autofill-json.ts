/** يحاول إصلاح JSON مقطوع (بسبب انتهاء عدد الرموز) بإغلاق النصوص والأقواس المفتوحة. */
export function repairJson(input: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (const ch of input) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      out += ch;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
    out += ch;
  }

  if (inString) out += '"';
  // احذف أي مفتاح/فاصلة معلّقة في النهاية
  out = out.replace(/,\s*$/, "");
  out = out.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === "{" ? "}" : "]";
  return out;
}
