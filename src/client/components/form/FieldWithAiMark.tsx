import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

type FieldWithAiMarkProps = {
  /** AI が入れた値（修正できる） */
  marked: boolean;
  /** 読み取り中で、この欄に AI が入れる可能性がある（まだ反映されていないことを示す） */
  pending?: boolean;
  children: ReactNode;
};

export const AI_PENDING_LABEL = "読み取り中";

/**
 * 欄の右端に AI の状態を出す。読み取り中は muted の「読み取り中」ピル、
 * 入ったら primary の「AI」ピル。両方は同時に出さない（pending が優先）。
 */
export function FieldWithAiMark({ marked, pending = false, children }: FieldWithAiMarkProps) {
  return (
    <div className={aiStateClassName("field-with-ai", marked, pending)}>
      {children}
      <AiMarkPill marked={marked} pending={pending} />
    </div>
  );
}

export function aiStateClassName(base: string, marked: boolean, pending: boolean): string {
  if (pending) {
    return `${base} is-pending`;
  }
  return marked ? `${base} is-ai` : base;
}

/** ピルだけ。独自レイアウトの欄（生産国のコンボボックス）が使う */
export function AiMarkPill({ marked, pending }: { marked: boolean; pending: boolean }) {
  if (pending) {
    return (
      <span className="pill ai ai-pending" role="status">
        <span className="ai-pending-spinner" aria-hidden />
        {AI_PENDING_LABEL}
      </span>
    );
  }
  if (marked) {
    return (
      <span className="pill ai">
        <Sparkles size={11} aria-hidden />
        AI
      </span>
    );
  }
  return null;
}
