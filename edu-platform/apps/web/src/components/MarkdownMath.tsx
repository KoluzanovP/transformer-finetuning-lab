"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Рендер Markdown с поддержкой математики (KaTeX) и GFM-таблиц/списков.
 * Формулы: `$...$` (в строке) и `$$...$$` (блок).
 */
export function MarkdownMath({ children }: { children: string }) {
  return (
    <div className="prose-edu">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: (p) => <h1 className="mb-3 mt-1 text-2xl font-bold text-slate-900" {...p} />,
          h2: (p) => <h2 className="mb-2 mt-4 text-xl font-bold text-slate-900" {...p} />,
          h3: (p) => <h3 className="mb-2 mt-3 text-lg font-semibold text-slate-800" {...p} />,
          p: (p) => <p className="my-2 leading-relaxed text-slate-700" {...p} />,
          ul: (p) => <ul className="my-2 list-disc space-y-1 pl-6 text-slate-700" {...p} />,
          ol: (p) => <ol className="my-2 list-decimal space-y-1 pl-6 text-slate-700" {...p} />,
          strong: (p) => <strong className="font-semibold text-slate-900" {...p} />,
          table: (p) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...p} />
            </div>
          ),
          th: (p) => <th className="border border-slate-300 bg-slate-50 px-3 py-1.5 text-left" {...p} />,
          td: (p) => <td className="border border-slate-200 px-3 py-1.5" {...p} />,
          code: (p) => <code className="rounded bg-slate-100 px-1 py-0.5 text-sm text-slate-800" {...p} />,
          blockquote: (p) => <blockquote className="my-2 border-l-4 border-brand-300 pl-3 italic text-slate-600" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
