"use client";

/**
 * Рендер инлайнового SVG-схемы. Убираем потенциально опасные конструкции
 * (скрипты, обработчики событий, внешние ссылки) — на случай пользовательского ввода.
 */
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*(\2)/gi, "");
}

export function Diagram({ svg, caption }: { svg: string; caption?: string }) {
  return (
    <figure className="my-3">
      <div
        className="mx-auto max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
      />
      {caption && <figcaption className="mt-1 text-center text-sm text-slate-500">{caption}</figcaption>}
    </figure>
  );
}
