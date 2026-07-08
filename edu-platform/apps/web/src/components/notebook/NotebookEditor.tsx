"use client";

import { useState } from "react";
import type {
  BlockType,
  LessonBlock,
  LessonDocument,
  QuizBlock,
} from "@edu/shared";
import { uploadFile } from "@/lib/api";

/** Кнопка загрузки файла на сервер (LOCAL/S3) с проставлением URL. */
function UploadButton({ kind, onUploaded }: { kind: "IMAGE" | "VIDEO" | "AUDIO"; onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`btn-ghost cursor-pointer !py-1 text-xs ${busy ? "opacity-50" : ""}`}>
      {busy ? "Загрузка…" : "Загрузить файл"}
      <input
        type="file"
        className="hidden"
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            const res = await uploadFile(f, kind);
            onUploaded(res.url);
          } catch {
            alert("Ошибка загрузки файла");
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}

let counter = 0;
function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  counter += 1;
  return `b_${counter}_${Date.now()}`;
}

function makeBlock(type: BlockType): LessonBlock {
  switch (type) {
    case "HEADING":
      return { id: uid(), type: "HEADING", text: "Заголовок", level: 2 };
    case "MARKDOWN":
      return { id: uid(), type: "MARKDOWN", markdown: "" };
    case "IMAGE":
      return { id: uid(), type: "IMAGE", url: "", alt: "" };
    case "VIDEO":
      return { id: uid(), type: "VIDEO", url: "", provider: "FILE" };
    case "AUDIO":
      return { id: uid(), type: "AUDIO", url: "" };
    case "CODE":
      return { id: uid(), type: "CODE", language: "python", code: "" };
    case "CALLOUT":
      return { id: uid(), type: "CALLOUT", variant: "info", markdown: "" };
    case "DIAGRAM":
      return { id: uid(), type: "DIAGRAM", svg: "", caption: "" };
    case "QUIZ":
      return {
        id: uid(),
        type: "QUIZ",
        question: "",
        multiple: false,
        options: [
          { id: uid(), text: "", correct: true },
          { id: uid(), text: "", correct: false },
        ],
      };
    case "DIVIDER":
      return { id: uid(), type: "DIVIDER" };
    default:
      return { id: uid(), type: "MARKDOWN", markdown: "" };
  }
}

const PALETTE: { type: BlockType; label: string }[] = [
  { type: "HEADING", label: "Заголовок" },
  { type: "MARKDOWN", label: "Текст" },
  { type: "IMAGE", label: "Фото" },
  { type: "VIDEO", label: "Видео" },
  { type: "AUDIO", label: "Аудио" },
  { type: "CODE", label: "Код" },
  { type: "CALLOUT", label: "Выноска" },
  { type: "DIAGRAM", label: "Схема" },
  { type: "QUIZ", label: "Тест" },
  { type: "DIVIDER", label: "Разделитель" },
];

export function NotebookEditor({
  value,
  onChange,
}: {
  value: LessonDocument;
  onChange: (doc: LessonDocument) => void;
}) {
  const blocks = value.blocks;

  const update = (next: LessonBlock[]) => onChange({ version: 1, blocks: next });
  const add = (type: BlockType) => update([...blocks, makeBlock(type)]);
  const patch = (id: string, changes: Partial<LessonBlock>) =>
    update(blocks.map((b) => (b.id === id ? ({ ...b, ...changes } as LessonBlock) : b)));
  const remove = (id: string) => update(blocks.filter((b) => b.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <div key={b.id} className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5">
            <span className="badge bg-slate-100 text-slate-500">{cellLabel(b.type)}</span>
            <div className="flex gap-1 text-slate-400">
              <button className="px-1 hover:text-slate-700" disabled={i === 0} onClick={() => move(b.id, -1)}>↑</button>
              <button className="px-1 hover:text-slate-700" disabled={i === blocks.length - 1} onClick={() => move(b.id, 1)}>↓</button>
              <button className="px-1 hover:text-red-600" onClick={() => remove(b.id)}>✕</button>
            </div>
          </div>
          <div className="p-3">
            <CellEditor block={b} patch={(c) => patch(b.id, c)} />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2 rounded-xl border border-dashed border-slate-300 p-3">
        <span className="mr-1 self-center text-sm text-slate-500">Добавить ячейку:</span>
        {PALETTE.map((p) => (
          <button key={p.type} className="btn-ghost !px-2 !py-1 text-xs" onClick={() => add(p.type)}>
            + {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function cellLabel(type: BlockType): string {
  return PALETTE.find((p) => p.type === type)?.label ?? type;
}

function CellEditor({ block, patch }: { block: LessonBlock; patch: (c: Partial<LessonBlock>) => void }) {
  switch (block.type) {
    case "HEADING":
      return (
        <div className="flex gap-2">
          <select className="input w-24" value={block.level} onChange={(e) => patch({ level: Number(e.target.value) as 1 | 2 | 3 })}>
            <option value={1}>H1</option>
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <input className="input" value={block.text} onChange={(e) => patch({ text: e.target.value })} placeholder="Текст заголовка" />
        </div>
      );
    case "MARKDOWN":
      return (
        <div className="space-y-1">
          <textarea className="input min-h-[100px]" value={block.markdown} onChange={(e) => patch({ markdown: e.target.value })} placeholder="Текст (Markdown). Формулы: $x^2$ в строке или $$...$$ блоком." />
          <p className="text-xs text-slate-400">Поддерживается Markdown и формулы KaTeX: <code>$a^2+b^2=c^2$</code>.</p>
        </div>
      );
    case "DIAGRAM":
      return (
        <div className="space-y-2">
          <textarea className="input min-h-[140px] font-mono text-xs" value={block.svg} onChange={(e) => patch({ svg: e.target.value })} placeholder="<svg viewBox='0 0 400 200'> ... </svg>" />
          <input className="input" value={block.caption ?? ""} onChange={(e) => patch({ caption: e.target.value })} placeholder="Подпись к схеме" />
        </div>
      );
    case "IMAGE":
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input className="input" value={block.url} onChange={(e) => patch({ url: e.target.value })} placeholder="URL изображения (S3/CDN)" />
            <UploadButton kind="IMAGE" onUploaded={(url) => patch({ url })} />
          </div>
          <input className="input" value={block.caption ?? ""} onChange={(e) => patch({ caption: e.target.value })} placeholder="Подпись (необязательно)" />
        </div>
      );
    case "VIDEO":
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select className="input w-32" value={block.provider ?? "FILE"} onChange={(e) => patch({ provider: e.target.value as "FILE" | "YOUTUBE" | "VIMEO" })}>
              <option value="FILE">Файл</option>
              <option value="YOUTUBE">YouTube</option>
              <option value="VIMEO">Vimeo</option>
            </select>
            <input className="input" value={block.url} onChange={(e) => patch({ url: e.target.value })} placeholder="URL видео / embed" />
            {block.provider === "FILE" && <UploadButton kind="VIDEO" onUploaded={(url) => patch({ url })} />}
          </div>
          <input className="input" value={block.caption ?? ""} onChange={(e) => patch({ caption: e.target.value })} placeholder="Подпись" />
        </div>
      );
    case "AUDIO":
      return (
        <div className="flex gap-2">
          <input className="input" value={block.url} onChange={(e) => patch({ url: e.target.value })} placeholder="URL аудио" />
          <UploadButton kind="AUDIO" onUploaded={(url) => patch({ url })} />
        </div>
      );
    case "CODE":
      return (
        <div className="space-y-2">
          <input className="input w-40" value={block.language} onChange={(e) => patch({ language: e.target.value })} placeholder="Язык (python)" />
          <textarea className="input min-h-[120px] font-mono text-sm" value={block.code} onChange={(e) => patch({ code: e.target.value })} placeholder="Код" />
        </div>
      );
    case "CALLOUT":
      return (
        <div className="space-y-2">
          <select className="input w-40" value={block.variant} onChange={(e) => patch({ variant: e.target.value as "info" | "warning" | "success" | "danger" })}>
            <option value="info">Инфо</option>
            <option value="warning">Внимание</option>
            <option value="success">Успех</option>
            <option value="danger">Опасно</option>
          </select>
          <textarea className="input min-h-[80px]" value={block.markdown} onChange={(e) => patch({ markdown: e.target.value })} placeholder="Текст выноски" />
        </div>
      );
    case "QUIZ":
      return <QuizEditor block={block} patch={patch} />;
    case "DIVIDER":
      return <p className="text-sm text-slate-400">— разделитель —</p>;
    default:
      return null;
  }
}

function QuizEditor({ block, patch }: { block: QuizBlock; patch: (c: Partial<LessonBlock>) => void }) {
  const setOption = (id: string, changes: Partial<QuizBlock["options"][number]>) =>
    patch({ options: block.options.map((o) => (o.id === id ? { ...o, ...changes } : o)) });
  return (
    <div className="space-y-2">
      <input className="input" value={block.question} onChange={(e) => patch({ question: e.target.value })} placeholder="Вопрос" />
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={block.multiple} onChange={(e) => patch({ multiple: e.target.checked })} />
        Несколько правильных ответов
      </label>
      {block.options.map((o) => (
        <div key={o.id} className="flex items-center gap-2">
          <input type="checkbox" checked={o.correct} onChange={(e) => setOption(o.id, { correct: e.target.checked })} title="Правильный" />
          <input className="input" value={o.text} onChange={(e) => setOption(o.id, { text: e.target.value })} placeholder="Вариант ответа" />
          <button className="text-slate-400 hover:text-red-600" onClick={() => patch({ options: block.options.filter((x) => x.id !== o.id) })}>✕</button>
        </div>
      ))}
      <button
        className="btn-ghost !py-1 text-xs"
        onClick={() => patch({ options: [...block.options, { id: uid(), text: "", correct: false }] })}
      >
        + Вариант
      </button>
    </div>
  );
}
