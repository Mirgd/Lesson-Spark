import { Fragment } from "react";

/**
 * يعرض نصاً قد يحتوي تنسيق Markdown بسيط (**غامق**) كنص غامق حقيقي،
 * بدل ظهور النجمتين حول الفعل في شاشة الطالب.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|__[^_]+__)/g);
  return (
    <p className={className}>
      {parts.map((part, i) => {
        const bold = /^(\*\*[^*]+\*\*|__[^_]+__)$/.test(part);
        const italic = !bold && /^\*[^*\n]+\*$/.test(part);
        if (bold) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (italic) return <strong key={i}>{part.slice(1, -1)}</strong>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}
