"use client";

import { useState } from "react";
import type { LessonBlock, LessonDocument, QuizBlock } from "@edu/shared";
import { mediaUrl } from "@/lib/api";
import { MarkdownMath } from "@/components/MarkdownMath";
import { Diagram } from "./Diagram";

export function NotebookViewer({ doc }: { doc: LessonDocument }) {
  if (!doc?.blocks?.length) {
    return <p className="text-slate-400">В этом уроке пока нет содержимого.</p>;
  }
  return (
    <div className="space-y-4">
      {doc.blocks.map((b) => (
        <BlockView key={b.id} block={b} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "HEADING": {
      const Tag = (`h${block.level + 1}`) as "h2" | "h3" | "h4";
      return <Tag className="text-xl font-bold text-slate-900">{block.text}</Tag>;
    }
    case "MARKDOWN":
      return <MarkdownMath>{block.markdown}</MarkdownMath>;
    case "DIAGRAM":
      return <Diagram svg={block.svg} caption={block.caption} />;
    case "IMAGE":
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl(block.url)} alt={block.alt ?? ""} className="max-h-96 rounded-lg border border-slate-200" />
          {block.caption && <figcaption className="mt-1 text-sm text-slate-500">{block.caption}</figcaption>}
        </figure>
      );
    case "VIDEO":
      return (
        <div>
          {block.provider === "YOUTUBE" ? (
            <iframe className="aspect-video w-full rounded-lg" src={block.url} allowFullScreen title="video" />
          ) : (
            <video controls src={mediaUrl(block.url)} className="w-full rounded-lg border border-slate-200" />
          )}
          {block.caption && <p className="mt-1 text-sm text-slate-500">{block.caption}</p>}
        </div>
      );
    case "AUDIO":
      return <audio controls src={mediaUrl(block.url)} className="w-full" />;
    case "CODE":
      return (
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
          <code>{block.code}</code>
        </pre>
      );
    case "CALLOUT": {
      const colors: Record<string, string> = {
        info: "border-blue-300 bg-blue-50 text-blue-900",
        warning: "border-amber-300 bg-amber-50 text-amber-900",
        success: "border-green-300 bg-green-50 text-green-900",
        danger: "border-red-300 bg-red-50 text-red-900",
      };
      return (
        <div className={`rounded-lg border-l-4 p-3 ${colors[block.variant]}`}>
          <MarkdownMath>{block.markdown}</MarkdownMath>
        </div>
      );
    }
    case "QUIZ":
      return <QuizView block={block} />;
    case "DIVIDER":
      return <hr className="border-slate-200" />;
    case "HOMEWORK_REF":
      return (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-brand-800">
          📝 К этому уроку прикреплено домашнее задание.
        </div>
      );
    default:
      return null;
  }
}

function QuizView({ block }: { block: QuizBlock }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);

  const toggle = (id: string) => {
    if (block.multiple) {
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    } else {
      setSelected([id]);
    }
  };

  const isCorrect =
    checked &&
    block.options.every((o) => o.correct === selected.includes(o.id));

  return (
    <div className="card">
      <div className="mb-2 font-medium">
        <MarkdownMath>{block.question}</MarkdownMath>
      </div>
      <div className="space-y-1">
        {block.options.map((o) => {
          const chosen = selected.includes(o.id);
          const show = checked && (o.correct || chosen);
          return (
            <button
              key={o.id}
              onClick={() => !checked && toggle(o.id)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                show
                  ? o.correct
                    ? "border-green-400 bg-green-50"
                    : "border-red-400 bg-red-50"
                  : chosen
                    ? "border-brand-400 bg-brand-50"
                    : "border-slate-200"
              }`}
            >
              <span className="text-slate-400">{block.multiple ? "☑" : "◯"}</span>
              <span className="[&_p]:my-0"><MarkdownMath>{o.text}</MarkdownMath></span>
            </button>
          );
        })}
      </div>
      {!checked ? (
        <button className="btn-primary mt-3" disabled={!selected.length} onClick={() => setChecked(true)}>
          Проверить
        </button>
      ) : (
        <div className="mt-3 text-sm">
          <span className={isCorrect ? "text-green-700" : "text-red-700"}>
            {isCorrect ? "Верно!" : "Есть ошибки."}
          </span>
          {block.explanation && <div className="mt-1 text-slate-500"><MarkdownMath>{block.explanation}</MarkdownMath></div>}
          <button className="btn-ghost ml-2 !py-1" onClick={() => { setChecked(false); setSelected([]); }}>
            Ещё раз
          </button>
        </div>
      )}
    </div>
  );
}
